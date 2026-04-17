'use client'

import { useMemo } from 'react'
import { Video } from 'lucide-react'

interface VideoPreviewProps {
  /** Product slug — used to resolve R2 video via /api/video-stream */
  slug: string
  /** External URL (YouTube/Vimeo/direct MP4) */
  url?: string | null
  /** R2 key present — stream via /api/video-stream?slug=... */
  r2Key?: string | null
  mimeType?: string | null
  title?: string
}

type VideoKind = 'youtube' | 'vimeo' | 'direct' | 'stream' | null

interface Parsed {
  kind: VideoKind
  src: string
}

function parseUrl(url: string): Parsed {
  const trimmed = url.trim()
  if (!trimmed) return { kind: null, src: '' }

  // YouTube
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (ytMatch) {
    return { kind: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1` }
  }

  // Vimeo
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeoMatch) {
    return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` }
  }

  // Direct MP4/WebM/MOV
  if (/\.(mp4|webm|mov)(\?|$)/i.test(trimmed)) {
    return { kind: 'direct', src: trimmed }
  }

  // Fallback — treat as direct if it's a plain URL
  if (/^https?:\/\//i.test(trimmed)) {
    return { kind: 'direct', src: trimmed }
  }

  return { kind: null, src: '' }
}

export function VideoPreview({ slug, url, r2Key, mimeType, title }: VideoPreviewProps) {
  const parsed = useMemo<Parsed>(() => {
    // Priority: external URL > R2 stream
    if (url && url.trim()) return parseUrl(url)
    if (r2Key) return { kind: 'stream', src: `/api/video-stream?slug=${encodeURIComponent(slug)}` }
    return { kind: null, src: '' }
  }, [url, r2Key, slug])

  if (!parsed.kind) return null

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
        <Video className="h-4 w-4 text-primary" />
        Video demo
      </div>
      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border bg-black">
        {parsed.kind === 'youtube' || parsed.kind === 'vimeo' ? (
          <iframe
            src={parsed.src}
            title={title || 'Product demo video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <video
            controls
            preload="metadata"
            className="absolute inset-0 w-full h-full object-contain bg-black"
          >
            <source src={parsed.src} type={mimeType || 'video/mp4'} />
            Trình duyệt của bạn không hỗ trợ video HTML5.
          </video>
        )}
      </div>
    </div>
  )
}
