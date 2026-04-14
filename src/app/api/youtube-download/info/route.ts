import { NextRequest, NextResponse } from 'next/server'
import { getVideoInfo } from '@/lib/youtube'

const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string' || !YOUTUBE_URL_REGEX.test(url)) {
      return NextResponse.json({ error: 'URL YouTube không hợp lệ' }, { status: 400 })
    }

    const info = await getVideoInfo(url)

    return NextResponse.json({
      videoId: info.id,
      title: info.title,
      duration: formatDuration(info.duration),
      channel: info.channel,
      viewCount: info.view_count,
      thumbnail: info.thumbnail,
    })
  } catch (err) {
    console.error('[YouTube Info]', err)
    return NextResponse.json(
      { error: 'Không thể lấy thông tin video. Vui lòng thử lại.' },
      { status: 500 }
    )
  }
}
