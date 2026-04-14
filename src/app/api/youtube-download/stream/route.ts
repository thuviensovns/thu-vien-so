import { NextRequest, NextResponse } from 'next/server'
import { streamVideo } from '@/lib/youtube'

const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/

/**
 * GET — streams a YouTube video through the server using youtubei.js.
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
    const stream = await streamVideo(youtubeUrl)

    const headers = new Headers()
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    headers.set('Content-Type', 'video/mp4')

    return new NextResponse(stream, { headers })
  } catch (err) {
    console.error('[YouTube Stream]', err)
    return NextResponse.json(
      { error: 'Không thể tải video từ YouTube. Vui lòng thử lại.' },
      { status: 502 }
    )
  }
}
