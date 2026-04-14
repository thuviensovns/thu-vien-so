import { NextRequest, NextResponse } from 'next/server'
import { getVideoInfo } from '@/lib/youtube'

const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/

/**
 * GET — fetches CDN URL server-side and proxies the YouTube video to the client.
 * This ensures the same server IP generates AND fetches the CDN URL (IP-locked by YouTube).
 *
 * Query params:
 *   url      – YouTube video URL (e.g. https://www.youtube.com/watch?v=xxxx)
 *   filename – desired download filename (URL-encoded)
 */
export async function GET(req: NextRequest) {
  const youtubeUrl = req.nextUrl.searchParams.get('url')
  const filename = req.nextUrl.searchParams.get('filename') || 'download.mp4'

  if (!youtubeUrl || !YOUTUBE_URL_REGEX.test(youtubeUrl)) {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
  }

  try {
    // Generate CDN URL and fetch it in the same server process (IP must match)
    const info = await getVideoInfo(youtubeUrl)

    if (!info.cdnUrl) {
      return NextResponse.json(
        { error: 'Không thể tạo link tải cho video này' },
        { status: 404 },
      )
    }

    // Use cache: 'no-store' to bypass Next.js fetch patching
    // and set a browser-like User-Agent to avoid YouTube CDN rejection
    const upstream = await fetch(info.cdnUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    })

    if (!upstream.ok || !upstream.body) {
      console.error('[YouTube Stream] CDN fetch failed:', upstream.status, upstream.statusText)
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
    headers.set('Content-Type', upstream.headers.get('content-type') || 'video/mp4')

    const contentLength = upstream.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)

    return new NextResponse(upstream.body as ReadableStream, { headers })
  } catch (err) {
    console.error('[YouTube Stream]', err)
    return NextResponse.json(
      { error: 'Không thể tải video từ YouTube. Vui lòng thử lại.' },
      { status: 502 },
    )
  }
}
