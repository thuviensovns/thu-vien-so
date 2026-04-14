/**
 * AI model proxy — bypasses upstream CORS (HuggingFace only allows
 * Origin=huggingface.co) by re-serving ONNX bytes from same origin.
 *
 * Streamed: no buffering in memory (30-80 MB files). Long cache headers
 * — clients already cache in IndexedDB, so this is mainly for CDN edge.
 */

import { NextRequest } from 'next/server'
import { MODELS } from '@/lib/audio/ai-models'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const model = MODELS[id]
  if (!model) {
    return new Response(`Unknown model id: ${id}`, { status: 404 })
  }
  if (!model.upstreamUrl) {
    return new Response(`Model ${id} not configured (missing upstream URL)`, { status: 501 })
  }

  let upstream: Response
  try {
    upstream = await fetch(model.upstreamUrl, { redirect: 'follow' })
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
