import { Innertube, Platform } from 'youtubei.js'
import vm from 'vm'

// Override Platform evaluator with Node.js vm for URL deciphering (needed for WEB/MWEB clients)
Platform.shim.eval = async (data: { output: string }, env: Record<string, unknown>) => {
  const context = vm.createContext({ ...env })
  const wrapped = '(function() {' + data.output + '})()'
  return vm.runInContext(wrapped, context, { timeout: 5000 })
}

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
 * Try multiple Innertube clients. Accept first one that returns any streaming format.
 * Supports both direct URLs (ANDROID/IOS) and deciphered URLs (WEB/MWEB).
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
      const formats = info.streaming_data?.formats || []

      // Try to get a usable URL from any format (direct or via decipher)
      for (const fmt of formats) {
        let url: string | null = null

        // Direct URL (ANDROID/IOS)
        if (fmt.url) {
          url = fmt.url
        } else {
          // Needs decipher (WEB/MWEB)
          try {
            url = await fmt.decipher(yt.session.player)
          } catch {
            continue
          }
        }

        if (url) {
          console.log(`[YouTube] Client=${client} SUCCESS (${fmt.url ? 'direct' : 'decipher'})`)
          return { info, client, cdnUrl: url }
        }
      }

      console.log(`[YouTube] Client=${client} no usable URL (${formats.length} formats)`)
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
    cdnUrl = result.cdnUrl
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
