'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import {
  Package, ImagePlus, Save, Star, RotateCcw, Upload, FileArchive, X, Loader2, Video, Music,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { categoryMeta } from '@/lib/config'
import { formatFileSize } from '@/lib/format'
import { toast } from 'sonner'

export interface FileData {
  r2Key: string
  fileName: string
  fileSize: number
  fileFormat: string
}

export interface VideoData {
  r2Key: string
  fileName: string
  fileSize: number
  mimeType: string
}

export interface AudioData {
  r2Key: string
  fileName: string
  fileSize: number
  mimeType: string
}

export interface ProductFormData {
  name: string
  slug: string
  type: string
  thumbnailUrl: string
  price: string
  originalPrice: string
  featured: boolean
  file: FileData | null
  downloadUrl: string
  video: VideoData | null
  videoUrl: string
  /** In-memory File waiting to be uploaded on save (matches image upload flow).
   *  Not persisted — reset after save completes. */
  videoPendingFile?: File | null
  /** Object URL (blob:) for local video preview before upload */
  videoPreviewUrl?: string
  /** Audio demo — direct URL (YouTube-free; any mp3/wav host) */
  audio: AudioData | null
  audioUrl: string
  audioPendingFile?: File | null
  audioPreviewUrl?: string
  bpm: string
  musicalKey: string
}

export const defaultForm: ProductFormData = {
  name: '',
  slug: '',
  type: 'sample-pack',
  thumbnailUrl: '/images/placeholder.jpg',
  price: '',
  originalPrice: '',
  featured: false,
  file: null,
  downloadUrl: '',
  video: null,
  videoUrl: '',
  videoPendingFile: null,
  videoPreviewUrl: '',
  audio: null,
  audioUrl: '',
  audioPendingFile: null,
  audioPreviewUrl: '',
  bpm: '',
  musicalKey: '',
}

export function autoSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

interface ProductFormProps {
  form: ProductFormData
  setForm: React.Dispatch<React.SetStateAction<ProductFormData>>
  editingId: string | null
  editingDemoId: string | null
  onSave: () => void
  onCancel: () => void
  onRestoreOriginal?: (id: string) => void
  saving?: boolean
}

export default function ProductForm({
  form, setForm, editingId, editingDemoId, onSave, onCancel, onRestoreOriginal, saving,
}: ProductFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const productFileRef = useRef<HTMLInputElement>(null)
  const videoFileRef = useRef<HTMLInputElement>(null)
  const audioFileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File quá lớn (tối đa 50MB). Hãy dùng link tải trực tiếp cho file lớn hơn.')
      return
    }

    const slug = form.slug || autoSlug(form.name) || 'untitled'
    setUploading(true)
    setUploadProgress(`Đang upload ${file.name} (${formatFileSize(file.size)})...`)

    try {
      // Step 1: ask server how to upload (presigned PUT vs direct POST)
      const presignRes = await fetch('/api/upload/product-file/presign', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || 'application/octet-stream',
          productSlug: slug,
        }),
      })

      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}))
        toast.error(data.error || `Lỗi xác nhận upload (${presignRes.status})`)
        return
      }

      const presign = await presignRes.json()

      // Step 2: upload bytes via the route the server picked
      let storageKey: string = presign.r2Key

      if (presign.mode === 'blob') {
        // Vercel Blob client upload — streams directly to Blob storage,
        // bypassing the Vercel 4.5MB function body limit.
        const { upload } = await import('@vercel/blob/client')
        // Multipart parts must be ≥5MB (S3 rule); smaller files hang
        // because the single chunk is rejected as undersized.
        const useMultipart = file.size > 5 * 1024 * 1024
        const blob = await upload(presign.pathname, file, {
          access: 'public',
          handleUploadUrl: presign.handshakeUrl,
          contentType: presign.contentType || file.type || 'application/octet-stream',
          multipart: useMultipart,
          onUploadProgress: ({ loaded, total }) => {
            const pct = total ? Math.round((loaded / total) * 100) : 0
            setUploadProgress(`Đang upload ${file.name} — ${pct}% (${formatFileSize(loaded)}/${formatFileSize(total || file.size)})`)
          },
        })
        storageKey = blob.url
      } else if (presign.mode === 'presign') {
        // Direct PUT to R2 — bypasses the Vercel 4.5MB function body limit
        const putRes = await fetch(presign.url, {
          method: 'PUT',
          headers: { 'Content-Type': presign.contentType || 'application/octet-stream' },
          body: file,
        })
        if (!putRes.ok) {
          toast.error(`Upload R2 thất bại (${putRes.status}). Kiểm tra CORS bucket nếu chạy production.`)
          return
        }
      } else {
        // Local dev fallback: server proxies to local filesystem
        const formData = new FormData()
        formData.append('file', file)
        formData.append('productSlug', slug)
        const res = await fetch('/api/upload/product-file', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast.error(data.error || `Upload thất bại (${res.status})`)
          return
        }
        // Use the server's actual r2Key (it generates its own timestamp)
        // so the stored path matches where the file landed on disk.
        const saved = await res.json().catch(() => null) as { r2Key?: string } | null
        if (saved?.r2Key) storageKey = saved.r2Key
      }

      setForm(prev => ({
        ...prev,
        file: {
          r2Key: storageKey,
          fileName: presign.fileName,
          fileSize: presign.fileSize,
          fileFormat: presign.fileFormat,
        },
      }))
      toast.success(`Đã upload: ${presign.fileName}`)
    } catch (err) {
      toast.error('Lỗi kết nối khi upload file: ' + (err instanceof Error ? err.message : 'unknown'))
    } finally {
      setUploading(false)
      setUploadProgress('')
      // Reset input so same file can be re-selected
      if (productFileRef.current) productFileRef.current.value = ''
    }
  }

  async function handleRemoveFile() {
    if (!form.file?.r2Key) {
      setForm(prev => ({ ...prev, file: null }))
      return
    }
    try {
      await fetch('/api/upload/product-file', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key: form.file.r2Key }),
      })
    } catch {}
    setForm(prev => ({ ...prev, file: null }))
    toast.success('Đã xóa file sản phẩm')
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate by extension — Windows often leaves file.type empty for videos
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExts = ['mp4', 'webm', 'mov']
    const isVideoType = file.type.startsWith('video/') || allowedExts.includes(ext)
    if (!isVideoType) {
      toast.error('Chỉ chấp nhận file video (MP4, WebM, MOV)')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File video quá lớn (tối đa 50MB). Hãy dùng link YouTube/Vimeo hoặc URL trực tiếp.')
      return
    }
    if (file.size > 4.5 * 1024 * 1024) {
      toast.warning('Video lớn hơn 4.5MB — trên Vercel Hobby có thể upload thất bại. Khuyến nghị dùng link YouTube/URL trực tiếp.')
    }

    // Revoke previous object URL to avoid memory leaks
    if (form.videoPreviewUrl) URL.revokeObjectURL(form.videoPreviewUrl)

    const previewUrl = URL.createObjectURL(file)
    setForm(prev => ({
      ...prev,
      videoPendingFile: file,
      videoPreviewUrl: previewUrl,
      // Clear any stored R2 video — the new pending file will replace it on save
      video: null,
    }))
    if (videoFileRef.current) videoFileRef.current.value = ''
  }

  async function handleRemoveVideo() {
    // Delete from R2 if already uploaded; local pending file needs no API call
    if (form.video?.r2Key) {
      try {
        await fetch('/api/upload/product-video', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ r2Key: form.video.r2Key }),
        })
      } catch {}
    }
    if (form.videoPreviewUrl) URL.revokeObjectURL(form.videoPreviewUrl)
    setForm(prev => ({
      ...prev,
      video: null,
      videoPendingFile: null,
      videoPreviewUrl: '',
    }))
    toast.success('Đã xóa video demo')
  }

  function handleAudioSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExts = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'oga', 'webm']
    const isAudioType = file.type.startsWith('audio/') || allowedExts.includes(ext)
    if (!isAudioType) {
      toast.error('Chỉ chấp nhận file audio (MP3, WAV, FLAC, AAC, M4A, OGG)')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File audio quá lớn (tối đa 50MB). Hãy dùng link URL trực tiếp.')
      return
    }
    if (file.size > 4.5 * 1024 * 1024) {
      toast.warning('Audio lớn hơn 4.5MB — sẽ upload qua Vercel Blob (bypass giới hạn 4.5MB của Vercel).')
    }

    if (form.audioPreviewUrl) URL.revokeObjectURL(form.audioPreviewUrl)

    const previewUrl = URL.createObjectURL(file)
    setForm(prev => ({
      ...prev,
      audioPendingFile: file,
      audioPreviewUrl: previewUrl,
      audio: null,
    }))
    if (audioFileRef.current) audioFileRef.current.value = ''
  }

  async function handleRemoveAudio() {
    if (form.audio?.r2Key) {
      try {
        await fetch('/api/upload/product-audio', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ r2Key: form.audio.r2Key }),
        })
      } catch {}
    }
    if (form.audioPreviewUrl) URL.revokeObjectURL(form.audioPreviewUrl)
    setForm(prev => ({
      ...prev,
      audio: null,
      audioPendingFile: null,
      audioPreviewUrl: '',
    }))
    toast.success('Đã xóa audio demo')
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chấp nhận file hình ảnh')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File quá lớn (tối đa 5MB)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.warning('Ảnh lớn hơn 2MB — khuyến nghị nén trước khi upload')
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setForm((prev) => ({ ...prev, thumbnailUrl: dataUrl }))
    }
    reader.readAsDataURL(file)
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          {editingId || editingDemoId ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
          {editingDemoId && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-warning border-warning/30">
              Demo
            </Badge>
          )}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Thumbnail upload */}
          <div className="sm:col-span-2">
            <label className="text-xs font-medium mb-1.5 block">Hình ảnh sản phẩm</label>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted/30 border border-border shrink-0">
                <Image
                  src={form.thumbnailUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                  sizes="80px"
                  unoptimized={form.thumbnailUrl.startsWith('data:')}
                />
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                  Chọn hình ảnh
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  JPG, PNG, WebP — tối đa 5MB
                </p>
                {form.thumbnailUrl !== '/images/placeholder.jpg' && (form.thumbnailUrl.startsWith('data:') || form.thumbnailUrl.startsWith('http')) && (
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, thumbnailUrl: '/images/placeholder.jpg' }))}
                    className="text-[10px] text-destructive hover:underline"
                  >
                    Xóa hình ảnh
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2">
              <label className="text-[10px] text-muted-foreground mb-1 block">Hoặc dán link ảnh trực tiếp (URL)</label>
              <Input
                value={form.thumbnailUrl.startsWith('data:') || form.thumbnailUrl === '/images/placeholder.jpg' ? '' : form.thumbnailUrl}
                onChange={(e) => {
                  const url = e.target.value.trim()
                  setForm((p) => ({ ...p, thumbnailUrl: url || '/images/placeholder.jpg' }))
                }}
                placeholder="https://i.imgur.com/... hoặc link ảnh khác"
                className="bg-muted/50 font-mono text-xs"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium mb-1 block">Tên sản phẩm *</label>
            <Input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value
                setForm((p) => ({
                  ...p,
                  name,
                  slug: p.slug === autoSlug(p.name) || !p.slug ? autoSlug(name) : p.slug,
                }))
              }}
              placeholder="VD: Nexus 4 Full Bank"
              className="bg-muted/50"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="text-xs font-medium mb-1 block">Slug (URL)</label>
            <Input
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
              placeholder="nexus-4-full-bank"
              className="bg-muted/50 font-mono text-xs"
            />
          </div>

          {/* Category type */}
          <div>
            <label className="text-xs font-medium mb-1 block">Danh mục</label>
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm outline-none"
            >
              {categoryMeta.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div>
            <label className="text-xs font-medium mb-1 block">Giá (VND) — 0 = miễn phí</label>
            <Input
              type="number"
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              placeholder="0"
              className="bg-muted/50 font-mono"
              min={0}
              step={1000}
            />
          </div>

          {/* Original price */}
          <div>
            <label className="text-xs font-medium mb-1 block">Giá gốc (tùy chọn)</label>
            <Input
              type="number"
              value={form.originalPrice}
              onChange={(e) => setForm((p) => ({ ...p, originalPrice: e.target.value }))}
              placeholder="Để trống nếu không giảm giá"
              className="bg-muted/50 font-mono"
              min={0}
              step={1000}
            />
          </div>

          {/* Featured */}
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
              className="accent-cyan-500"
              id="featured-check"
            />
            <label htmlFor="featured-check" className="text-xs font-medium cursor-pointer flex items-center gap-1">
              <Star className="h-3 w-3 text-warning" />
              Sản phẩm nổi bật
            </label>
          </div>

          {/* Download URL */}
          <div className="sm:col-span-2">
            <label className="text-xs font-medium mb-1.5 block">Link tải trực tiếp (Google Drive, Mediafire...)</label>
            <Input
              value={form.downloadUrl}
              onChange={(e) => setForm((p) => ({ ...p, downloadUrl: e.target.value }))}
              placeholder="https://drive.google.com/... hoặc https://mediafire.com/..."
              className="bg-muted/50 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Ưu tiên dùng link tải trực tiếp. Nếu để trống, hệ thống sẽ dùng file upload R2 bên dưới.
            </p>
          </div>

          {/* Demo video URL */}
          <div className="sm:col-span-2">
            <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
              <Video className="h-3.5 w-3.5 text-primary" />
              Link video demo (YouTube, Vimeo, hoặc MP4 URL)
            </label>
            <Input
              value={form.videoUrl}
              onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))}
              placeholder="https://youtu.be/... hoặc https://cdn.../demo.mp4"
              className="bg-muted/50 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Ưu tiên dùng link YouTube/Vimeo/MP4 URL. Nếu để trống, hệ thống sẽ dùng video upload R2 bên dưới.
            </p>
          </div>

          {/* Demo video upload — local preview, uploads on save (same flow as image) */}
          <div className="sm:col-span-2">
            <label className="text-xs font-medium mb-1.5 block">Video demo (MP4/WebM/MOV — tùy chọn, dùng khi không có link)</label>
            <div className="flex items-start gap-4">
              {/* Local preview player (blob: for pending file, API stream for already-uploaded) */}
              <div className="relative h-24 w-40 shrink-0 rounded-lg overflow-hidden bg-black border border-border flex items-center justify-center">
                {form.videoPreviewUrl ? (
                  <video
                    src={form.videoPreviewUrl}
                    controls
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                ) : form.video?.r2Key ? (
                  <div className="text-center">
                    <Video className="h-8 w-8 text-primary mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">Đã lưu R2</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Video className="h-8 w-8 text-muted-foreground/50 mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">Chưa có video</p>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <input
                  ref={videoFileRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => videoFileRef.current?.click()}
                    disabled={saving}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Chọn file video
                  </Button>
                  {(form.videoPendingFile || form.video?.r2Key) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveVideo}
                      disabled={saving}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Xóa
                    </Button>
                  )}
                </div>

                {form.videoPendingFile && (
                  <p className="text-[11px] text-warning truncate">
                    <strong>Sẵn sàng upload:</strong> {form.videoPendingFile.name} ({formatFileSize(form.videoPendingFile.size)}) — bấm <strong>Lưu</strong> để đẩy lên R2.
                  </p>
                )}

                {!form.videoPendingFile && form.video?.r2Key && (
                  <p className="text-[11px] text-success truncate">
                    <strong>Đã lưu:</strong> {form.video.fileName} ({formatFileSize(form.video.fileSize)})
                  </p>
                )}

                <p className="text-[10px] text-muted-foreground">
                  MP4, WebM, MOV — tối đa 50MB. Upload trực tiếp lên R2 (bypass giới hạn Vercel). Video dài nên dùng link YouTube/URL.
                </p>
              </div>
            </div>
          </div>

          {/* Demo audio URL */}
          <div className="sm:col-span-2">
            <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
              <Music className="h-3.5 w-3.5 text-primary" />
              Link audio demo (MP3 / WAV / FLAC URL)
            </label>
            <Input
              value={form.audioUrl}
              onChange={(e) => setForm((p) => ({ ...p, audioUrl: e.target.value }))}
              placeholder="https://cdn.../preview.mp3"
              className="bg-muted/50 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Ưu tiên dùng link audio trực tiếp. Nếu để trống, hệ thống sẽ dùng file audio upload bên dưới.
            </p>
          </div>

          {/* Demo audio upload — local preview, uploads on save (same flow as video) */}
          <div className="sm:col-span-2">
            <label className="text-xs font-medium mb-1.5 block">Audio demo (MP3/WAV/FLAC — tùy chọn, dùng khi không có link)</label>
            <div className="flex items-start gap-4">
              {/* Local preview player (blob: for pending file, audio URL for already-uploaded) */}
              <div className="relative h-24 w-40 shrink-0 rounded-lg overflow-hidden bg-black border border-border flex items-center justify-center p-2">
                {form.audioPreviewUrl ? (
                  <audio
                    src={form.audioPreviewUrl}
                    controls
                    className="w-full"
                  />
                ) : form.audio?.r2Key ? (
                  <div className="text-center">
                    <Music className="h-8 w-8 text-primary mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">Đã lưu</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Music className="h-8 w-8 text-muted-foreground/50 mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">Chưa có audio</p>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <input
                  ref={audioFileRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/aac,audio/mp4,audio/ogg,audio/webm,.mp3,.wav,.flac,.aac,.m4a,.ogg,.oga,.webm"
                  onChange={handleAudioSelect}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => audioFileRef.current?.click()}
                    disabled={saving}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Chọn file audio
                  </Button>
                  {(form.audioPendingFile || form.audio?.r2Key) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAudio}
                      disabled={saving}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Xóa
                    </Button>
                  )}
                </div>

                {form.audioPendingFile && (
                  <p className="text-[11px] text-warning truncate">
                    <strong>Sẵn sàng upload:</strong> {form.audioPendingFile.name} ({formatFileSize(form.audioPendingFile.size)}) — bấm <strong>Lưu</strong> để đẩy lên.
                  </p>
                )}

                {!form.audioPendingFile && form.audio?.r2Key && (
                  <p className="text-[11px] text-success truncate">
                    <strong>Đã lưu:</strong> {form.audio.fileName} ({formatFileSize(form.audio.fileSize)})
                  </p>
                )}

                <p className="text-[10px] text-muted-foreground">
                  MP3, WAV, FLAC, AAC, M4A, OGG — tối đa 50MB. Upload trực tiếp lên Vercel Blob (bypass giới hạn 4.5MB).
                </p>
              </div>
            </div>

            {/* BPM / Key quick metadata */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">BPM (tùy chọn)</label>
                <Input
                  type="number"
                  value={form.bpm}
                  onChange={(e) => setForm((p) => ({ ...p, bpm: e.target.value }))}
                  placeholder="VD: 128"
                  className="bg-muted/50 font-mono text-xs h-8"
                  min={0}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Key (tùy chọn)</label>
                <Input
                  value={form.musicalKey}
                  onChange={(e) => setForm((p) => ({ ...p, musicalKey: e.target.value }))}
                  placeholder="VD: Am, C#"
                  className="bg-muted/50 font-mono text-xs h-8"
                />
              </div>
            </div>
          </div>

          {/* Product file upload */}
          <div className="sm:col-span-2">
            <label className="text-xs font-medium mb-1.5 block">File sản phẩm (tùy chọn — dùng khi không có link tải)</label>
            {form.file ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-success/20 bg-success/5">
                <FileArchive className="h-8 w-8 text-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{form.file.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(form.file.fileSize)} • .{form.file.fileFormat}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  ref={productFileRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/aiff,audio/midi,video/mp4,application/zip,application/x-rar-compressed,application/x-7z-compressed,.zip,.rar,.7z,.flp,.wav,.mp3,.mp4,.flac,.aif,.aiff,.mid,.midi,.fxp,.fxb,.nki,.dll,.vst3,.au,.component"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => productFileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{uploadProgress}</>
                  ) : (
                    <><Upload className="mr-1.5 h-3.5 w-3.5" />Chọn file sản phẩm</>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  ZIP, RAR, 7Z, FLP, WAV, MP3, MP4, FLAC, VST... — tối đa 50MB. Upload trực tiếp lên R2 (bypass giới hạn Vercel 4.5MB).
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={saving || uploading}>
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang lưu...
              </span>
            ) : uploading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang upload file sản phẩm...
              </span>
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {editingId || editingDemoId ? 'Cập nhật' : 'Thêm sản phẩm'}
              </>
            )}
          </Button>
          {editingDemoId && onRestoreOriginal && (
            <Button size="sm" variant="outline" onClick={() => { onRestoreOriginal(editingDemoId); onCancel() }} disabled={saving || uploading}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Khôi phục gốc
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onCancel} disabled={saving || uploading}>
            Hủy
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
