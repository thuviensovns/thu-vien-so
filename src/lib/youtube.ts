import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

// yt-dlp binary path — downloaded to project bin/ or from system PATH
const YT_DLP_PATH = process.env.YT_DLP_PATH || path.join(process.cwd(), 'bin', 'yt-dlp.exe')

interface YtDlpFormat {
  format_id: string
  ext: string
  height?: number
  width?: number
  vcodec: string
  acodec: string
  abr?: number
  tbr?: number
  filesize?: number
  filesize_approx?: number
  url: string
  quality_label?: string
  format_note?: string
}

interface YtDlpInfo {
  id: string
  title: string
  duration: number
  channel: string
  uploader: string
  view_count: number
  thumbnail: string
  formats: YtDlpFormat[]
}

export async function getVideoInfo(videoUrl: string): Promise<YtDlpInfo> {
  const { stdout } = await execFileAsync(YT_DLP_PATH, [
    '-j',
    '--no-check-certificates',
    '--no-warnings',
    '--no-playlist',
    videoUrl,
  ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 })

  try {
    return JSON.parse(stdout)
  } catch {
    throw new Error('Không thể phân tích dữ liệu video từ yt-dlp')
  }
}

export async function getFormatUrl(videoUrl: string, formatId: string): Promise<string> {
  const { stdout } = await execFileAsync(YT_DLP_PATH, [
    '-f', formatId,
    '-g',
    '--no-check-certificates',
    '--no-warnings',
    '--no-playlist',
    videoUrl,
  ], { timeout: 30000 })

  return stdout.trim()
}
