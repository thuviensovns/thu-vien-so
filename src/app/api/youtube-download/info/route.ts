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

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string' || !YOUTUBE_URL_REGEX.test(url)) {
      return NextResponse.json({ error: 'URL YouTube không hợp lệ' }, { status: 400 })
    }

    const info = await getVideoInfo(url)

    // Build MP4 format list from downloadable combined formats
    const mp4Formats = info.downloadFormats
      .filter(f => f.hasVideo && f.ext === 'mp4')
      .map(f => ({
        quality: f.quality,
        formatId: f.formatId,
        size: f.filesize ? formatFileSize(f.filesize) : '',
        hasAudio: f.hasAudio,
      }))

    // MP3/audio: if any combined format has audio, offer audio extraction
    const audioFormat = info.downloadFormats.find(f => f.hasAudio)
    const mp3Format = audioFormat
      ? { formatId: audioFormat.formatId, size: '' }
      : null

    return NextResponse.json({
      videoId: info.id,
      title: info.title,
      duration: formatDuration(info.duration),
      channel: info.channel,
      viewCount: info.view_count,
      thumbnail: info.thumbnail,
      mp4Formats,
      mp3Format,
    })
  } catch (err) {
    console.error('[YouTube Info]', err)
    return NextResponse.json(
      { error: 'Không thể lấy thông tin video. Vui lòng thử lại.' },
      { status: 500 }
    )
  }
}
