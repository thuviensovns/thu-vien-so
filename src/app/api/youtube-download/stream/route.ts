import { NextRequest, NextResponse } from 'next/server'
import { getVideoStream } from '@/lib/youtube'

const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/

/**
 * GET proxy that streams a YouTube CDN URL or youtubei.js stream
 * back with Content-Disposition: attachment so browser downloads directly.
 *
 * Query params:
 *   cdnUrl   – pre-resolved googlevideo.com URL (from /download endpoint)
 *   filename – desired download filename (URL-encoded)
 *   youtubeUrl – original YouTube URL (for server-side stream fallback)
 */
export async function GET(req: NextRequest) {
  const cdnUrl = req.nextUrl.searchParams.get('cdnUrl')
  const youtubeUrl = req.nextUrl.searchParams.get('youtubeUrl')
  const filename = req.nextUrl.searchParams.get('filename') || 'download'

  // Mode 1: CDN URL proxy (direct download)
  if (cdnUrl) {
    try {
      const parsed = new URL(cdnUrl)
      if (!parsed.hostname.endsWith('.googlevideo.com') && !parsed.hostname.endsWith('.youtube.com')) {
        return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
    }

    try {
      const upstream = await fetch(cdnUrl)

      if (!upstream.ok || !upstream.body) {
        return NextResponse.json(
          { error: 'Không thể tải file từ YouTube' },
          { status: 502 }
        )
      }

      const headers = new Headers()
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)

      const contentType = upstream.headers.get('content-type')
      if (contentType) headers.set('Content-Type', contentType)

      const contentLength = upstream.headers.get('content-length')
      if (contentLength) headers.set('Content-Length', contentLength)

      return new NextResponse(upstream.body as ReadableStream, { headers })
    } catch {
      return NextResponse.json(
        { error: 'Lỗi kết nối đến YouTube' },
        { status: 502 }
      )
    }
  }

  // Mode 2: Server-side stream via youtubei.js (for audio extraction)
  if (youtubeUrl) {
    if (!YOUTUBE_URL_REGEX.test(youtubeUrl)) {
      return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
    }

    try {
      const { stream, mimeType } = await getVideoStream(youtubeUrl)

      const headers = new Headers()
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
      headers.set('Content-Type', mimeType)

      return new NextResponse(stream, { headers })
    } catch (err) {
      console.error('[YouTube Stream]', err)
      return NextResponse.json(
        { error: 'Không thể tải video từ YouTube' },
        { status: 502 }
      )
    }
  }

  return NextResponse.json({ error: 'Missing cdnUrl or youtubeUrl' }, { status: 400 })
}
