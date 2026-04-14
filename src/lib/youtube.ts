import { Innertube, Platform } from 'youtubei.js'
import vm from 'vm'

// Override Platform evaluator with Node.js vm for URL deciphering
Platform.shim.eval = async (data: { output: string }, env: Record<string, unknown>) => {
  const context = vm.createContext({ ...env })
  const wrapped = '(function() {' + data.output + '})()'
  return vm.runInContext(wrapped, context, { timeout: 5000 })
}

let innertubeInstance: Awaited<ReturnType<typeof Innertube.create>> | null = null

async function getInnertube() {
  if (!innertubeInstance) {
    innertubeInstance = await Innertube.create({ generate_session_locally: true })
  }
  return innertubeInstance
}

export interface YtVideoInfo {
  id: string
  title: string
  duration: number
  channel: string
  uploader: string
  view_count: number
  thumbnail: string
  /** Combined formats with direct downloadable URLs (typically 360p) */
  downloadFormats: YtDownloadFormat[]
  /** All available qualities from adaptive formats (metadata only, no URLs) */
  availableQualities: string[]
  hasAudio: boolean
}

export interface YtDownloadFormat {
  formatId: string
  quality: string
  ext: string
  hasAudio: boolean
  hasVideo: boolean
  filesize?: number
  url: string
}

function extractVideoId(videoUrl: string): string | null {
  const match = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] || null
}

export async function getVideoInfo(videoUrl: string): Promise<YtVideoInfo> {
  const yt = await getInnertube()

  const videoId = extractVideoId(videoUrl)
  if (!videoId) throw new Error('Invalid YouTube URL')

  const info = await yt.getBasicInfo(videoId)
  const details = info.basic_info

  const downloadFormats: YtDownloadFormat[] = []
  const availableQualities: string[] = []

  // Extract download URLs from combined formats (these have decipherable URLs)
  for (const fmt of info.streaming_data?.formats || []) {
    let url = ''
    try {
      url = await fmt.decipher(yt.session.player) || ''
    } catch {
      continue
    }
    if (!url) continue

    downloadFormats.push({
      formatId: String(fmt.itag),
      quality: fmt.quality_label || `${fmt.height || 360}p`,
      ext: fmt.mime_type?.includes('mp4') ? 'mp4' : 'webm',
      hasAudio: fmt.has_audio ?? true,
      hasVideo: fmt.has_video ?? true,
      filesize: fmt.content_length ? Number(fmt.content_length) : undefined,
      url,
    })
  }

  // Collect available qualities from adaptive formats (for info display only)
  const seenQualities = new Set<string>()
  for (const fmt of info.streaming_data?.adaptive_formats || []) {
    if (fmt.has_video && fmt.quality_label && !seenQualities.has(fmt.quality_label)) {
      seenQualities.add(fmt.quality_label)
      availableQualities.push(fmt.quality_label)
    }
  }

  // Check if any format has audio
  const hasAudio = downloadFormats.some(f => f.hasAudio)

  return {
    id: details.id || videoId,
    title: details.title || 'Không rõ tiêu đề',
    duration: details.duration || 0,
    channel: details.channel?.name || details.author || '',
    uploader: details.author || '',
    view_count: details.view_count || 0,
    thumbnail: `https://i.ytimg.com/vi/${details.id || videoId}/hqdefault.jpg`,
    downloadFormats,
    availableQualities,
    hasAudio,
  }
}

/**
 * Get a direct download URL for a specific format.
 * Only works for combined formats that have decipherable URLs.
 */
export async function getFormatUrl(videoUrl: string, formatId: string): Promise<string> {
  const info = await getVideoInfo(videoUrl)
  const fmt = info.downloadFormats.find(f => f.formatId === formatId)
  if (!fmt?.url) throw new Error('Format not found or URL not available')
  return fmt.url
}

/**
 * Stream a YouTube video as a ReadableStream using youtubei.js download API.
 * This handles SABR protocol internally for combined formats.
 */
export async function getVideoStream(videoUrl: string): Promise<{
  stream: ReadableStream<Uint8Array>
  mimeType: string
  contentLength?: number
}> {
  const yt = await getInnertube()
  const videoId = extractVideoId(videoUrl)
  if (!videoId) throw new Error('Invalid YouTube URL')

  const stream = await yt.download(videoId, {
    type: 'video+audio',
    quality: 'best',
  })

  return {
    stream: stream as ReadableStream<Uint8Array>,
    mimeType: 'video/mp4',
  }
}
