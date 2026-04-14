import { NextRequest, NextResponse } from 'next/server'
import https from 'https'
import { getVideoInfo, getProxyConfig } from '@/lib/youtube'

const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/

/**
 * Fetch a URL using Node.js native https module (bypasses Next.js fetch patching).
 */
function nativeFetch(
  url: string,
  extraHeaders: Record<string, string> = {},
): Promise<{ stream: ReadableStream; status: number; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'com.google.android.youtube/19.09.36 (Linux; U; Android 14) gzip',
          Accept: '*/*',
          ...extraHeaders,
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          nativeFetch(res.headers.location, extraHeaders).then(resolve).catch(reject)
          return
        }
        const headers: Record<string, string> = {}
        for (const [key, val] of Object.entries(res.headers)) {
          if (val) headers[key] = Array.isArray(val) ? val[0] : val
        }
        const stream = new ReadableStream({
          start(controller) {
            res.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
            res.on('end', () => controller.close())
            res.on('error', (err) => controller.error(err))
          },
          cancel() {
            res.destroy()
          },
        })
        resolve({ stream, status: res.statusCode || 0, headers })
      },
    )
    req.on('error', reject)
    req.setTimeout(60_000, () => req.destroy(new Error('Request timeout')))
  })
}

function extractVideoId(u: string): string | null {
  const m = u.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] || null
}

/**
 * GET — proxies YouTube video bytes to the client.
 * If YT_PROXY_URL is set, routes through the home-PC tunnel (works for all videos).
 * Otherwise fetches YouTube CDN directly (Vercel IP — limited coverage).
 */
export async function GET(req: NextRequest) {
  const youtubeUrl = req.nextUrl.searchParams.get('url')
  const filename = req.nextUrl.searchParams.get('filename') || 'download.mp4'

  if (!youtubeUrl || !YOUTUBE_URL_REGEX.test(youtubeUrl)) {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
  }

  const proxy = getProxyConfig()

  // Sanitize filename for Content-Disposition (RFC 5987)
  const safeName =
    filename
      .replace(/[^\w\s\-_.()àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi, '_')
      .replace(/_+/g, '_')
      .trim() || 'download.mp4'

  try {
    let streamSrc: { stream: ReadableStream; headers: Record<string, string> }

    if (proxy) {
      // PROXY PATH — stream directly through the home tunnel.
      const videoId = extractVideoId(youtubeUrl)
      if (!videoId) return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
      const proxyUrl = `${proxy.base}/stream?url=${encodeURIComponent(youtubeUrl)}`
      console.log('[YouTube Stream] routing via proxy tunnel')
      streamSrc = await nativeFetch(proxyUrl, {
        'ngrok-skip-browser-warning': '1',
        ...(proxy.secret ? { 'x-proxy-secret': proxy.secret } : {}),
      })
    } else {
      // DIRECT PATH — resolve CDN URL via Innertube, fetch from Vercel.
      const info = await getVideoInfo(youtubeUrl)
      if (!info.cdnUrl) {
        return NextResponse.json(
          { error: 'Không thể tạo link tải cho video này' },
          { status: 404 },
        )
      }
      console.log('[YouTube Stream] direct CDN fetch')
      streamSrc = await nativeFetch(info.cdnUrl)
    }

    const headers = new Headers()
    headers.set(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    )
    headers.set('Content-Type', streamSrc.headers['content-type'] || 'video/mp4')
    const contentLength = streamSrc.headers['content-length']
    if (contentLength) headers.set('Content-Length', contentLength)

    return new NextResponse(streamSrc.stream, { headers })
  } catch (err) {
    console.error('[YouTube Stream]', err)
    return NextResponse.json(
      { error: 'Không thể tải video từ YouTube. Vui lòng thử lại.' },
      { status: 502 },
    )
  }
}
