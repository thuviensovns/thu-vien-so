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

    const videoId = info.id
    const title = info.title || 'Không rõ tiêu đề'
    const duration = info.duration || 0
    const channel = info.channel || info.uploader || ''
    const viewCount = info.view_count || 0
    const thumbnail = info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

    // ── MP4 Video formats ──
    const mp4Formats: Array<{
      quality: string
      formatId: string
      size: string
      hasAudio: boolean
    }> = []

    const seenQualities = new Set<string>()

    // Sort formats by height (highest first) then prefer formats with audio
    const videoFormats = info.formats
      .filter(f => f.ext === 'mp4' && f.vcodec !== 'none' && f.url && (f.height || 0) >= 360)
      .sort((a, b) => {
        const hDiff = (b.height || 0) - (a.height || 0)
        if (hDiff !== 0) return hDiff
        // Prefer combined (has audio) over video-only
        const aHas = a.acodec !== 'none' ? 1 : 0
        const bHas = b.acodec !== 'none' ? 1 : 0
        return bHas - aHas
      })

    for (const fmt of videoFormats) {
      const q = `${fmt.height}p`
      if (seenQualities.has(q)) continue
      seenQualities.add(q)

      const hasAudio = fmt.acodec !== 'none'
      const bytes = fmt.filesize || fmt.filesize_approx || 0

      mp4Formats.push({
        quality: q,
        formatId: fmt.format_id,
        size: bytes > 0 ? formatFileSize(bytes) : '',
        hasAudio,
      })
    }

    // ── Best audio format (single) ──
    const bestAudio = info.formats
      .filter(f => f.acodec !== 'none' && f.vcodec === 'none' && f.url)
      .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))[0]

    const mp3Format = bestAudio
      ? {
          formatId: bestAudio.format_id,
          size: (bestAudio.filesize || bestAudio.filesize_approx || 0) > 0
            ? formatFileSize(bestAudio.filesize || bestAudio.filesize_approx || 0)
            : '',
        }
      : null

    return NextResponse.json({
      videoId,
      title,
      duration: formatDuration(duration),
      channel,
      viewCount,
      thumbnail,
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
