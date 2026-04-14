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
  /** Which client succeeded (for debugging) */
  client?: string
}

function extractVideoId(videoUrl: string): string | null {
  const match = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] || null
}

/**
 * Fetch video metadata via YouTube oEmbed API (public, no auth needed, works from any IP).
 */
async function fetchOembedInfo(videoId: string): Promise<{ title: string; channel: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { title?: string; author_name?: string }
    return { title: data.title || '', channel: data.author_name || '' }
  } catch {
    return null
  }
}

/**
 * Try multiple Innertube clients to work around YouTube bot-detection on datacenter IPs.
 */
async function tryClients(videoId: string) {
  const yt = await getInnertube()
  const clients: Array<'ANDROID' | 'IOS' | 'MWEB' | 'TV_SIMPLY' | 'WEB'> = [
    'ANDROID',
    'IOS',
    'MWEB',
    'TV_SIMPLY',
    'WEB',
  ]

  for (const client of clients) {
    try {
      const info = await yt.getBasicInfo(videoId, { client })
      const hasTitle = !!info.basic_info.title
      const hasFormats = (info.streaming_data?.formats?.length || 0) > 0
      const hasDirectUrl = !!info.streaming_data?.formats?.[0]?.url

      console.log(
        `[YouTube] Client=${client} title=${hasTitle} fmts=${hasFormats} directUrl=${hasDirectUrl}`,
      )

      // Only accept if we have metadata AND a direct URL (no decipher needed)
      if (hasTitle && hasDirectUrl) {
        return { info, client }
      }
    } catch (e) {
      console.log(`[YouTube] Client=${client} error:`, (e as Error).message.slice(0, 80))
    }
  }

  return null
}

/**
 * Get video metadata + direct CDN download URL.
 * Uses multiple Innertube clients with fallback, plus oEmbed API for reliable metadata.
 */
export async function getVideoInfo(videoUrl: string): Promise<YtVideoInfo> {
  const videoId = extractVideoId(videoUrl)
  if (!videoId) throw new Error('Invalid YouTube URL')

  // Try Innertube clients for streaming data
  const result = await tryClients(videoId)

  let cdnUrl: string | null = null
  let title = ''
  let channel = ''
  let duration = 0
  let view_count = 0
  let client: string | undefined

  if (result) {
    const d = result.info.basic_info
    title = d.title || ''
    channel = d.channel?.name || d.author || ''
    duration = d.duration || 0
    view_count = d.view_count || 0
    cdnUrl = result.info.streaming_data?.formats?.[0]?.url || null
    client = result.client
  }

  // Fallback to oEmbed for metadata if Innertube failed or returned empty
  if (!title) {
    const oembed = await fetchOembedInfo(videoId)
    if (oembed) {
      title = oembed.title
      channel = channel || oembed.channel
    }
  }

  return {
    id: videoId,
    title: title || 'Không rõ tiêu đề',
    duration,
    channel,
    view_count,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    cdnUrl,
    client,
  }
}
