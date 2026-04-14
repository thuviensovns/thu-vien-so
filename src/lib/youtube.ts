import { Innertube, Platform } from 'youtubei.js'
import vm from 'vm'

// Override Platform evaluator with Node.js vm for URL deciphering
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
}

function extractVideoId(videoUrl: string): string | null {
  const match = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] || null
}

/**
 * Get video metadata + direct CDN download URL for combined format.
 */
export async function getVideoInfo(videoUrl: string): Promise<YtVideoInfo> {
  const yt = await getInnertube()
  const videoId = extractVideoId(videoUrl)
  if (!videoId) throw new Error('Invalid YouTube URL')

  const info = await yt.getBasicInfo(videoId)
  const d = info.basic_info

  // Extract CDN URL from combined formats (video+audio, typically 360p)
  let cdnUrl: string | null = null
  for (const fmt of info.streaming_data?.formats || []) {
    try {
      const url = await fmt.decipher(yt.session.player)
      if (url) {
        cdnUrl = url
        break
      }
    } catch {
      // Skip formats that can't be deciphered
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
