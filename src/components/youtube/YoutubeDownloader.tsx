'use client'

import { useCallback, useState } from 'react'
import {
  Search,
  Download,
  Music,
  Video,
  Image,
  Loader2,
  PlayCircle,
  Clock,
  Eye,
  User,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

interface VideoInfo {
  videoId: string
  title: string
  duration: string
  channel: string
  viewCount: number
  thumbnail: string
}

const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/

function formatViews(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function YoutubeDownloader() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [video, setVideo] = useState<VideoInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      toast.error('Vui lòng nhập URL YouTube')
      return
    }
    if (!YOUTUBE_URL_REGEX.test(trimmed)) {
      toast.error('URL không hợp lệ. Vui lòng nhập link YouTube.')
      return
    }

    setLoading(true)
    setVideo(null)
    setError(null)

    try {
      const res = await fetch('/api/youtube-download/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Không thể lấy thông tin video')
        toast.error(data.error || 'Không thể lấy thông tin video')
        return
      }

      setVideo(data)
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.')
      toast.error('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [url])

  const handleDownload = useCallback(
    async (type: 'mp4' | 'mp3') => {
      if (!video) return
      setDownloading(type)

      const filename = `${video.title}.mp4`
      const streamUrl = `/api/youtube-download/stream?url=${encodeURIComponent(url.trim())}&filename=${encodeURIComponent(filename)}`

      try {
        toast.info('Đang chuẩn bị tải xuống...')
        const res = await fetch(streamUrl)

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Lỗi không xác định' }))
          throw new Error(err.error || `Lỗi ${res.status}`)
        }

        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = filename
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(blobUrl)
        toast.success(type === 'mp3' ? 'Đã tải âm thanh!' : 'Đã tải video!')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không thể tải video. Vui lòng thử lại.')
      } finally {
        setDownloading(null)
      }
    },
    [video, url]
  )

  const handleReset = useCallback(() => {
    setVideo(null)
    setUrl('')
    setError(null)
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-2.5">
          <div className="flex items-center justify-center size-10 rounded-xl bg-red-500/10">
            <PlayCircle className="size-6 text-red-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">Tải Video YouTube</h1>
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Tải video MP4 và âm thanh từ YouTube — miễn phí, không giới hạn
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <Input
          placeholder="Dán link YouTube vào đây..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleSearch()}
          disabled={loading || !!video}
          className="flex-1 h-11"
        />
        {video ? (
          <Button variant="outline" onClick={handleReset} className="h-11 gap-1.5 shrink-0">
            <RotateCcw className="size-4" />
            <span className="hidden sm:inline">Video khác</span>
          </Button>
        ) : (
          <Button onClick={handleSearch} disabled={loading} className="h-11 gap-1.5 shrink-0">
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            <span className="hidden sm:inline">{loading ? 'Đang tìm...' : 'Tìm kiếm'}</span>
          </Button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <Card>
          <CardContent className="pt-0 space-y-4">
            <div className="flex gap-3">
              <Skeleton className="w-32 sm:w-44 aspect-video rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && !loading && (
        <Card className="border-destructive/30">
          <CardContent className="pt-0">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10">
                <PlayCircle className="size-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium">{error}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Kiểm tra lại URL hoặc thử video khác
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Thử lại
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Result */}
      {video && !loading && (
        <Card>
          <CardContent className="pt-0 space-y-4">
            {/* YouTube Video Embed */}
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
              <iframe
                src={`https://www.youtube.com/embed/${video.videoId}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>

            {/* Video Info */}
            <div>
              <h2 className="font-semibold text-sm sm:text-base leading-snug line-clamp-2">
                {video.title}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {video.channel && (
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3" />
                    {video.channel}
                  </span>
                )}
                {video.duration && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {video.duration}
                  </span>
                )}
                {video.viewCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3" />
                    {formatViews(video.viewCount)}
                  </span>
                )}
              </div>
            </div>

            {/* Download Tabs */}
            <Tabs defaultValue="mp4">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="mp4" className="gap-1.5">
                  <Video className="size-3.5" />
                  MP4
                </TabsTrigger>
                <TabsTrigger value="mp3" className="gap-1.5">
                  <Music className="size-3.5" />
                  Âm thanh
                </TabsTrigger>
                <TabsTrigger value="thumbnail" className="gap-1.5">
                  <Image className="size-3.5" />
                  Thumbnail
                </TabsTrigger>
              </TabsList>

              {/* MP4 Tab */}
              <TabsContent value="mp4">
                <button
                  onClick={() => handleDownload('mp4')}
                  disabled={downloading !== null}
                  className="flex w-full items-center justify-between rounded-lg border p-3 transition-all hover:bg-accent hover:border-accent-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center size-8 rounded-md bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                      <Video className="size-4 text-blue-500" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="font-medium text-sm">Tải Video MP4</span>
                      <span className="text-[10px] text-muted-foreground">Video kèm âm thanh</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {downloading === 'mp4' ? (
                      <Loader2 className="size-4 animate-spin text-blue-500" />
                    ) : (
                      <Download className="size-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                    )}
                  </div>
                </button>
              </TabsContent>

              {/* Audio Tab */}
              <TabsContent value="mp3">
                <button
                  onClick={() => handleDownload('mp3')}
                  disabled={downloading !== null}
                  className="flex w-full items-center justify-between rounded-lg border p-3 transition-all hover:bg-accent hover:border-accent-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center size-8 rounded-md bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                      <Music className="size-4 text-green-500" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="font-medium text-sm">Tải Âm thanh</span>
                      <span className="text-[10px] text-muted-foreground">MP4 có âm thanh — mở bằng trình nghe nhạc</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {downloading === 'mp3' ? (
                      <Loader2 className="size-4 animate-spin text-green-500" />
                    ) : (
                      <Download className="size-4 text-muted-foreground group-hover:text-green-500 transition-colors" />
                    )}
                  </div>
                </button>
              </TabsContent>

              {/* Thumbnail Tab */}
              <TabsContent value="thumbnail">
                <div className="space-y-3">
                  {[
                    { label: 'Full HD (1920×1080)', file: 'maxresdefault.jpg' },
                    { label: 'SD (640×480)', file: 'sddefault.jpg' },
                    { label: 'HQ (480×360)', file: 'hqdefault.jpg' },
                    { label: 'MQ (320×180)', file: 'mqdefault.jpg' },
                  ].map(thumb => {
                    const thumbUrl = `https://i.ytimg.com/vi/${video.videoId}/${thumb.file}`
                    return (
                      <div key={thumb.file} className="rounded-lg border overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbUrl}
                          alt={`${video.title} - ${thumb.label}`}
                          referrerPolicy="no-referrer"
                          className="w-full aspect-video object-cover bg-muted"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <div className="flex items-center justify-between p-2.5">
                          <div className="flex items-center gap-2">
                            <Image className="size-4 text-purple-500" />
                            <span className="text-sm font-medium">{thumb.label}</span>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(thumbUrl)
                                const blob = await res.blob()
                                const objUrl = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = objUrl
                                a.download = `${video.title}_${thumb.file}`
                                document.body.appendChild(a)
                                a.click()
                                a.remove()
                                URL.revokeObjectURL(objUrl)
                                toast.success('Đã tải thumbnail')
                              } catch {
                                toast.error('Không thể tải ảnh')
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                          >
                            <Download className="size-3.5" />
                            Tải ảnh
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Features (shown before search) */}
      {!video && !loading && !error && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="flex flex-col items-center gap-2 rounded-xl border p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10">
                <Video className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium">MP4</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Video + Âm thanh</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-xl border p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/10">
                <Music className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium">Âm thanh</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Nghe nhạc</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-xl border p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center size-10 rounded-lg bg-orange-500/10">
                <CheckCircle2 className="size-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium">Miễn phí</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Không giới hạn</p>
              </div>
            </div>
          </div>

          {/* How to use */}
          <Card>
            <CardContent className="pt-0">
              <h2 className="font-semibold text-sm mb-3">Hướng dẫn sử dụng</h2>
              <ol className="space-y-2.5">
                {[
                  'Sao chép link video YouTube bạn muốn tải',
                  'Dán link vào ô tìm kiếm và nhấn "Tìm kiếm"',
                  'Chọn MP4 hoặc Âm thanh và nhấn tải về',
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-muted-foreground leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      )}

      {/* Footer note */}
      <p className="text-[10px] sm:text-xs text-muted-foreground text-center pb-4">
        Công cụ hỗ trợ tải video không có bản quyền hoặc video bạn sở hữu.
      </p>
    </div>
  )
}
