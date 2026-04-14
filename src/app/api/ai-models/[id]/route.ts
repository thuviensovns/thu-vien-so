/**
 * AI model proxy — bypasses upstream CORS (HuggingFace only allows
 * Origin=huggingface.co) by re-serving ONNX bytes from same origin.
 *
 * Supports runtime URL override via `?upstream=<https_url>`. To prevent
 * SSRF, the host is checked against a small allowlist of known public
 * ONNX hosters.
 */

import { NextRequest } from 'next/server'
import { MODELS } from '@/lib/audio/ai-models'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const HOST_ALLOWLIST = new Set<string>([
  'huggingface.co',
  'cas-bridge.xethub.hf.co', // HF LFS backing store
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
])

function isAllowedHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'https:') return false
    return HOST_ALLOWLIST.has(u.hostname)
  } catch {
    return false
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const model = MODELS[id]
  if (!model) {
    return new Response(`Unknown model id: ${id}`, { status: 404 })
  }

  const override = req.nextUrl.searchParams.get('upstream')
  const target = override || model.upstreamUrl
  if (!target) {
    return new Response(`Model ${id} not configured (missing upstream URL)`, { status: 501 })
  }
  if (override && !isAllowedHost(override)) {
    return new Response(`Upstream host not allowed (allowlist: ${[...HOST_ALLOWLIST].join(', ')})`, { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch(target, { redirect: 'follow' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(`Upstream fetch failed: ${msg}`, { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream returned ${upstream.status}`, { status: 502 })
  }

  const headers = new Headers({
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
  const len = upstream.headers.get('content-length')
  if (len) headers.set('Content-Length', len)

  return new Response(upstream.body, { status: 200, headers })
}
