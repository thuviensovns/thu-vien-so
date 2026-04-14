import { Innertube, Platform } from 'youtubei.js'
import { generate as generatePoToken } from 'youtube-po-token-generator'
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

/**
 * Public Piped instances — community-hosted YouTube proxies on residential IPs.
 * Used as fallback when Innertube fails (e.g. YouTube blocks Vercel datacenter IPs).
 * List ordered by historical reliability; first success wins.
 */
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.syncpundit.io',
  'https://pipedapi-libre.kavin.rocks',
  'https://pipedapi.in.projectsegfau.lt',
]

/**
 * Wrap a promise with a hard timeout. Rejects if it doesn't settle in time.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ])
}

/**
 * Get Innertube instance with PO token (best-effort, short timeout).
 * PO token bypasses some bot checks but hangs on Vercel → hard cap at 3s.
 */
async function getInnertube() {
  const now = Date.now()
  if (!innertubeInstance || now - instanceCreatedAt > INSTANCE_TTL) {
    try {
      const { poToken, visitorData } = await withTimeout(
        generatePoToken(),
        3000,
        'PO token',
      )
      innertubeInstance = await Innertube.create({
        po_token: poToken,
        visitor_data: visitorData,
        generate_session_locally: true,
      })
      console.log('[YouTube] Innertube initialized with PO token')
    } catch (err) {
      console.warn('[YouTube] PO token skipped:', (err as Error).message)
      innertubeInstance = await Innertube.create({ generate_session_locally: true })
    }
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
  /** Which source succeeded (for debugging) */
  client?: string
}

function extractVideoId(videoUrl: string): string | null {
  const match = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] || null
}

/**
 * Fetch video metadata via YouTube oEmbed API (public, no auth, works from any IP).
 */
async function fetchOembedInfo(videoId: string): Promise<{ title: string; channel: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { title?: string; author_name?: string }
    return { title: data.title || '', channel: data.author_name || '' }
  } catch {
    return null
  }
}

/**
 * Try multiple Innertube clients. Accept first with a usable streaming URL.
 */
async function tryInnertubeClients(videoId: string) {
  const yt = await withTimeout(getInnertube(), 5000, 'Innertube init')
  const clients: Array<'ANDROID' | 'IOS' | 'MWEB' | 'WEB'> = ['ANDROID', 'IOS', 'MWEB', 'WEB']

  for (const client of clients) {
    try {
      const info = await withTimeout(
        yt.getBasicInfo(videoId, { client }),
        8000,
        `client ${client}`,
      )
      const formats = info.streaming_data?.formats || []

      for (const fmt of formats) {
        let url: string | null = null
        if (fmt.url) {
          url = fmt.url
        } else {
          try {
            url = await fmt.decipher(yt.session.player)
          } catch {
            continue
          }
        }
        if (url) {
          console.log(`[YouTube] Innertube/${client} SUCCESS`)
          return { info, client, cdnUrl: url }
        }
      }
      console.log(`[YouTube] Innertube/${client} no usable URL (${formats.length} formats)`)
    } catch (e) {
      console.log(`[YouTube] Innertube/${client} error:`, (e as Error).message.slice(0, 80))
    }
  }
  return null
}

interface PipedStream {
  url: string
  quality: string
  format: string
  videoOnly: boolean
  bitrate?: number
  mimeType?: string
}

interface PipedResponse {
  title?: string
  uploader?: string
  uploaderUrl?: string
  duration?: number
  thumbnailUrl?: string
  videoStreams?: PipedStream[]
  audioStreams?: PipedStream[]
  error?: string
}

/**
 * Try a single Piped instance. Returns stream URL + metadata if successful.
 */
async function tryPipedInstance(instance: string, videoId: string) {
  try {
    const res = await fetch(`${instance}/streams/${videoId}`, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; thuvienso.top)' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as PipedResponse
    if (data.error || !data.videoStreams) return null

    // Prefer combined (not videoOnly) streams
    const combined = data.videoStreams.find((s) => !s.videoOnly && s.url)
    const stream = combined || data.videoStreams.find((s) => s.url)
    if (!stream?.url) return null

    return {
      cdnUrl: stream.url,
      title: data.title || '',
      channel: data.uploader || '',
      duration: data.duration || 0,
      instance,
    }
  } catch {
    return null
  }
}

/**
 * Try Piped public instances in parallel, return first successful result.
 */
async function tryPiped(videoId: string) {
  const attempts = PIPED_INSTANCES.map((inst) =>
    tryPipedInstance(inst, videoId).then((r) => (r ? { ...r, instance: inst } : null)),
  )
  // Race: resolve as soon as any returns a hit
  for (const promise of attempts) {
    const result = await promise.catch(() => null)
    if (result) {
      console.log(`[YouTube] Piped/${result.instance} SUCCESS`)
      return result
    }
  }
  return null
}

/**
 * Get video metadata + direct CDN download URL.
 * Strategy: Innertube (fast when works) → Piped public instances (fallback) → oEmbed (metadata only).
 */
export async function getVideoInfo(videoUrl: string): Promise<YtVideoInfo> {
  const videoId = extractVideoId(videoUrl)
  if (!videoId) throw new Error('Invalid YouTube URL')

  let cdnUrl: string | null = null
  let title = ''
  let channel = ''
  let duration = 0
  let view_count = 0
  let source: string | undefined

  // Try Innertube first (fast path)
  try {
    const result = await withTimeout(tryInnertubeClients(videoId), 20000, 'Innertube chain')
    if (result) {
      const d = result.info.basic_info
      title = d.title || ''
      channel = d.channel?.name || d.author || ''
      duration = d.duration || 0
      view_count = d.view_count || 0
      cdnUrl = result.cdnUrl
      source = `innertube/${result.client}`
    }
  } catch (e) {
    console.warn('[YouTube] Innertube chain failed:', (e as Error).message)
  }

  // Fallback: Piped public instances
  if (!cdnUrl) {
    try {
      const piped = await withTimeout(tryPiped(videoId), 10000, 'Piped chain')
      if (piped) {
        cdnUrl = piped.cdnUrl
        title = title || piped.title
        channel = channel || piped.channel
        duration = duration || piped.duration
        source = `piped/${piped.instance.replace('https://', '')}`
      }
    } catch (e) {
      console.warn('[YouTube] Piped chain failed:', (e as Error).message)
    }
  }

  // Final fallback: oEmbed for metadata only
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
    client: source,
  }
}
