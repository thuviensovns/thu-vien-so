import { NextRequest, NextResponse } from 'next/server'
import { getProxyConfig } from '@/lib/youtube'

const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/

/**
 * Returns a direct stream URL on the home-PC tunnel so the browser can download
 * cross-origin without the 60s Vercel function limit. The URL embeds the proxy
 * secret; it's valid only while the tunnel is up and rotates when ngrok URL changes.
 */
export async function GET(req: NextRequest) {
  const youtubeUrl = req.nextUrl.searchParams.get('url')
  const kind = req.nextUrl.searchParams.get('kind') === 'audio' ? 'audio' : 'video'
  const filename = req.nextUrl.searchParams.get('filename') || undefined

  if (!youtubeUrl || !YOUTUBE_URL_REGEX.test(youtubeUrl)) {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
  }

  const proxy = getProxyConfig()
  if (!proxy) {
    return NextResponse.json({ error: 'Proxy chưa được cấu hình' }, { status: 503 })
  }

  try {
    const hc = await fetch(`${proxy.base}/health`, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      signal: AbortSignal.timeout(5000),
    })
    const ct = (hc.headers.get('content-type') || '').toLowerCase()
    if (!hc.ok || ct.includes('text/html')) throw new Error(`bad health ${hc.status}`)
  } catch {
    return NextResponse.json(
      { error: 'Máy chủ proxy đang offline. Vui lòng liên hệ admin.' },
      { status: 503 },
    )
  }

  const params = new URLSearchParams({
    url: youtubeUrl,
    kind,
    ...(filename ? { filename } : {}),
    ...(proxy.secret ? { secret: proxy.secret } : {}),
    // Ngrok free tier shows a warning page for browser requests without this.
    'ngrok-skip-browser-warning': '1',
  })

  return NextResponse.json({
    streamUrl: `${proxy.base}/stream?${params.toString()}`,
    kind,
  })
}
