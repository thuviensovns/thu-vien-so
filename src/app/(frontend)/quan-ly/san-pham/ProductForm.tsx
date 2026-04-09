'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import {
  Package, ImagePlus, Save, Star, RotateCcw, Upload, FileArchive, X, Loader2,
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
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 4.5 * 1024 * 1024) {
      toast.error('File quá lớn (tối đa 4.5MB trên Vercel Hobby). Hãy dùng link tải trực tiếp.')
      return
    }

    const slug = form.slug || autoSlug(form.name) || 'untitled'
    setUploading(true)
    setUploadProgress(`Đang upload ${file.name} (${formatFileSize(file.size)})...`)

    try {
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
        setUploading(false)
        setUploadProgress('')
        return
      }

      const data = await res.json()
      setForm(prev => ({
        ...prev,
        file: {
          r2Key: data.r2Key,
          fileName: data.fileName,
          fileSize: data.fileSize,
          fileFormat: data.fileFormat,
        },
      }))
      toast.success(`Đã upload: ${data.fileName}`)
    } catch {
      toast.error('Lỗi kết nối khi upload file')
    }
    setUploading(false)
    setUploadProgress('')
    // Reset input so same file can be re-selected
    if (productFileRef.current) productFileRef.current.value = ''
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
                {form.thumbnailUrl !== '/images/placeholder.jpg' && form.thumbnailUrl.startsWith('data:') && (
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
                  accept=".zip,.rar,.7z,.flp,.wav,.mp3,.flac,.aif,.aiff,.mid,.midi,.fxp,.fxb,.nki,.dll,.vst3,.au,.component"
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
                  ZIP, RAR, 7Z, FLP, WAV, MP3, FLAC, VST... — tối đa 4.5MB (Vercel Hobby). Dùng link tải bên trên cho file lớn.
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang lưu...
              </span>
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {editingId || editingDemoId ? 'Cập nhật' : 'Thêm sản phẩm'}
              </>
            )}
          </Button>
          {editingDemoId && onRestoreOriginal && (
            <Button size="sm" variant="outline" onClick={() => { onRestoreOriginal(editingDemoId); onCancel() }}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Khôi phục gốc
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
