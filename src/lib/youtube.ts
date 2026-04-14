import { Innertube } from 'youtubei.js'

let innertubeInstance: Awaited<ReturnType<typeof Innertube.create>> | null = null
let instanceCreatedAt = 0
const INSTANCE_TTL = 30 * 60_000

async function getInnertube() {
  const now = Date.now()
  if (!innertubeInstance || now - instanceCreatedAt > INSTANCE_TTL) {
    innertubeInstance = await Innertube.create({ generate_session_locally: true })
    instanceCreatedAt = now
  }
  return innertubeInstance
}

export interface YtVideoInfo {
  id: string
  title: string
  duration: number
  channel: string
  view_count: number
  thumbnail: string
  /** Direct CDN URL for the best combined (video+audio) format */
  cdnUrl: string | null
}

function extractVideoId(videoUrl: string): string | null {
  const match = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] || null
}

/**
 * Get video metadata + direct CDN download URL.
 * Uses ANDROID client which provides direct URLs without decipher,
 * and is not bot-detected on datacenter IPs (like Vercel).
 */
export async function getVideoInfo(videoUrl: string): Promise<YtVideoInfo> {
  const yt = await getInnertube()
  const videoId = extractVideoId(videoUrl)
  if (!videoId) throw new Error('Invalid YouTube URL')

  const info = await yt.getBasicInfo(videoId, { client: 'ANDROID' })
  const d = info.basic_info

  // ANDROID client provides direct URLs (no signature cipher)
  let cdnUrl: string | null = null
  for (const fmt of info.streaming_data?.formats || []) {
    if (fmt.url) {
      cdnUrl = fmt.url
      break
    }
  }

  return {
    id: d.id || videoId,
    title: d.title || 'Không rõ tiêu đề',
    duration: d.duration || 0,
    channel: d.channel?.name || d.author || '',
    view_count: d.view_count || 0,
    thumbnail: `https://i.ytimg.com/vi/${d.id || videoId}/hqdefault.jpg`,
    cdnUrl,
  }
}
