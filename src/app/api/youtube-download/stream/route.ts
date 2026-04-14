import { NextRequest, NextResponse } from 'next/server'
import https from 'https'
import { getVideoInfo } from '@/lib/youtube'

const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/

/**
 * Fetch a URL using Node.js native https module (bypasses Next.js fetch patching).
 * Returns a Web ReadableStream + headers.
 */
function nativeFetch(url: string): Promise<{ stream: ReadableStream; status: number; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'com.google.android.youtube/19.09.36 (Linux; U; Android 14) gzip',
        'Accept': '*/*',
      },
    }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        nativeFetch(res.headers.location).then(resolve).catch(reject)
        return
      }

      const headers: Record<string, string> = {}
      for (const [key, val] of Object.entries(res.headers)) {
        if (val) headers[key] = Array.isArray(val) ? val[0] : val
      }

      // Convert Node.js IncomingMessage (Readable) to Web ReadableStream
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
    })

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy(new Error('Request timeout'))
    })
  })
}

/**
 * GET — fetches CDN URL server-side and proxies the YouTube video to the client.
 *
 * Query params:
 *   url      – YouTube video URL
 *   filename – desired download filename (URL-encoded)
 */
export async function GET(req: NextRequest) {
  const youtubeUrl = req.nextUrl.searchParams.get('url')
  const filename = req.nextUrl.searchParams.get('filename') || 'download.mp4'

  if (!youtubeUrl || !YOUTUBE_URL_REGEX.test(youtubeUrl)) {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
  }

  try {
    const info = await getVideoInfo(youtubeUrl)

    if (!info.cdnUrl) {
      return NextResponse.json(
        { error: 'Không thể tạo link tải cho video này' },
        { status: 404 },
      )
    }

    console.log('[YouTube Stream] CDN URL obtained, fetching with native https...')

    const upstream = await nativeFetch(info.cdnUrl)

    if (upstream.status !== 200) {
      console.error('[YouTube Stream] CDN fetch failed:', upstream.status)
      return NextResponse.json(
        { error: 'Không thể tải file từ YouTube' },
        { status: 502 },
      )
    }

    // Sanitize filename for Content-Disposition (RFC 5987)
    const safeName = filename
      .replace(/[^\w\s\-_.()àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi, '_')
      .replace(/_+/g, '_')
      .trim() || 'download.mp4'

    const headers = new Headers()
    headers.set(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    )
    headers.set('Content-Type', upstream.headers['content-type'] || 'video/mp4')

    const contentLength = upstream.headers['content-length']
    if (contentLength) headers.set('Content-Length', contentLength)

    return new NextResponse(upstream.stream, { headers })
  } catch (err) {
    console.error('[YouTube Stream]', err)
    return NextResponse.json(
      { error: 'Không thể tải video từ YouTube. Vui lòng thử lại.' },
      { status: 502 },
    )
  }
}
