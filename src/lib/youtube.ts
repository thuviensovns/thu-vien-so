import { Innertube, Platform } from 'youtubei.js'
import { generate as generatePoToken } from 'youtube-po-token-generator'
import vm from 'vm'

// Override Platform evaluator with Node.js vm for URL deciphering (WEB/MWEB clients)
Platform.shim.eval = async (data: { output: string }, env: Record<string, unknown>) => {
  const context = vm.createContext({ ...env })
  const wrapped = '(function() {' + data.output + '})()'
  return vm.runInContext(wrapped, context, { timeout: 5000 })
}

let innertubeInstance: Awaited<ReturnType<typeof Innertube.create>> | null = null
let instanceCreatedAt = 0
const INSTANCE_TTL = 30 * 60_000

/** Hard-timeout wrapper. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ])
}

async function getInnertube() {
  const now = Date.now()
  if (!innertubeInstance || now - instanceCreatedAt > INSTANCE_TTL) {
    try {
      const { poToken, visitorData } = await withTimeout(generatePoToken(), 3000, 'PO token')
      innertubeInstance = await Innertube.create({
        po_token: poToken,
        visitor_data: visitorData,
        generate_session_locally: true,
      })
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
  /** Direct CDN URL for best combined (video+audio) format */
  cdnUrl: string | null
  /** Which source succeeded */
  client?: string
}

function extractVideoId(videoUrl: string): string | null {
  const m = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] || null
}

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
 * PROXY PATH — call the local yt-proxy running on user's home PC (via Cloudflare Tunnel).
 * Set env YT_PROXY_URL (+ optional YT_PROXY_SECRET) to enable. Works for 100% of videos
 * because residential IPs are not blocked by YouTube.
 */
async function tryProxy(videoId: string): Promise<YtVideoInfo | null> {
  const base = process.env.YT_PROXY_URL?.trim().replace(/\/$/, '')
  if (!base) return null
  const secret = process.env.YT_PROXY_SECRET?.trim()
  try {
    const res = await fetch(
      `${base}/info?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`,
      {
        signal: AbortSignal.timeout(15_000),
        headers: secret ? { 'x-proxy-secret': secret } : {},
      },
    )
    if (!res.ok) {
      console.warn(`[YouTube] Proxy HTTP ${res.status}`)
      return null
    }
    const data = (await res.json()) as YtVideoInfo
    if (!data.cdnUrl) return null
    return { ...data, client: `proxy/${data.client || 'unknown'}` }
  } catch (e) {
    console.warn('[YouTube] Proxy error:', (e as Error).message)
    return null
  }
}

async function tryInnertubeClients(videoId: string) {
  const yt = await withTimeout(getInnertube(), 5000, 'Innertube init')
  const clients: Array<'ANDROID' | 'IOS' | 'MWEB' | 'WEB'> = ['ANDROID', 'IOS', 'MWEB', 'WEB']

  for (const client of clients) {
    try {
      const info = await withTimeout(yt.getBasicInfo(videoId, { client }), 8000, `client ${client}`)
      const formats = info.streaming_data?.formats || []
      for (const fmt of formats) {
        let url: string | null = null
        if (fmt.url) url = fmt.url
        else {
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
    } catch (e) {
      console.log(`[YouTube] Innertube/${client} error:`, (e as Error).message.slice(0, 80))
    }
  }
  return null
}

/**
 * Get video metadata + direct CDN download URL.
 * Strategy: Proxy (if configured → 100% coverage) → Innertube (limited coverage on Vercel) → oEmbed (metadata only).
 */
export async function getVideoInfo(videoUrl: string): Promise<YtVideoInfo> {
  const videoId = extractVideoId(videoUrl)
  if (!videoId) throw new Error('Invalid YouTube URL')

  // 1. Proxy first (if configured)
  const proxied = await tryProxy(videoId)
  if (proxied?.cdnUrl) return proxied

  // 2. Innertube fallback
  let cdnUrl: string | null = null
  let title = ''
  let channel = ''
  let duration = 0
  let view_count = 0
  let source: string | undefined

  try {
    const result = await withTimeout(tryInnertubeClients(videoId), 20_000, 'Innertube chain')
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

  // 3. oEmbed for metadata-only fallback
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

/**
 * Exposed for the stream route to know whether to proxy bytes via tunnel or fetch direct.
 */
export function getProxyConfig() {
  const base = process.env.YT_PROXY_URL?.trim().replace(/\/$/, '')
  if (!base) return null
  return { base, secret: process.env.YT_PROXY_SECRET?.trim() || '' }
}
