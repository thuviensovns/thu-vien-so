'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface DownloadRecord {
  id: string
  product: { id: string; name: string; slug: string; thumbnail?: { url?: string } | string; type?: string }
  downloadCount: number
  maxDownloads: number
  expiresAt: string
  order?: { orderNumber: string }
}

interface DownloadsTabProps {
  downloads: DownloadRecord[]
  loading: boolean
  onRefresh: () => void
  onDownloadsChange: React.Dispatch<React.SetStateAction<DownloadRecord[]>>
}

export default function DownloadsTab({ downloads, loading, onRefresh, onDownloadsChange }: DownloadsTabProps) {
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  async function handleDownload(downloadId: string) {
    setLoadingIds((prev) => new Set(prev).add(downloadId))
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ downloadId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.open(data.url, '_blank')
          toast.success('Đang tải xuống...')
          onDownloadsChange((prev) =>
            prev.map((d) => d.id === downloadId ? { ...d, downloadCount: d.downloadCount + 1 } : d)
          )
          return
        }
        toast.error('Không tìm thấy file tải xuống.')
        return
      }
      if (res.status === 401) {
        toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
        return
      }
      if (res.status === 429) {
        toast.error('Đã hết lượt tải xuống cho sản phẩm này.')
        return
      }
      if (res.status === 410) {
        toast.error('Link tải xuống đã hết hạn.')
        return
      }
      if (res.status === 503) {
        toast.error('Máy chủ tạm thời không khả dụng. Vui lòng thử lại sau.')
        return
      }
      toast.error('Tải xuống thất bại. Vui lòng thử lại.')
    } catch {
      toast.error('Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.')
    } finally {
      setLoadingIds((prev) => { const next = new Set(prev); next.delete(downloadId); return next })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold">Downloads</h2>
        <Button variant="ghost" size="sm" className="text-xs" onClick={onRefresh}>Làm mới</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : downloads.length === 0 ? (
        <div className="text-center py-12">
          <Download className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Chưa có sản phẩm nào để tải</p>
          <p className="text-xs text-muted-foreground mt-1">Mua sản phẩm để bắt đầu download</p>
          <Button asChild className="mt-4" variant="outline" size="sm">
            <Link href="/san-pham">Mua sản phẩm</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((dl) => {
            const product = typeof dl.product === 'object' ? dl.product : null
            const thumbUrl = product?.thumbnail
              ? (typeof product.thumbnail === 'object' ? product.thumbnail.url : product.thumbnail)
              : '/images/placeholder.jpg'
            const isExpired = new Date(dl.expiresAt) < new Date()
            const remaining = dl.maxDownloads - dl.downloadCount
            const canDownload = remaining > 0 && !isExpired

            return (
              <div key={dl.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-border">
                <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-muted/30">
                  <Image
                    src={thumbUrl || '/images/placeholder.jpg'}
                    alt={product?.name || 'Product'}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {product ? (
                    <Link href={`/san-pham/${product.slug}`} className="font-medium text-sm hover:text-primary transition-colors line-clamp-1">
                      {product.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">Sản phẩm</span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{dl.downloadCount}/{dl.maxDownloads} lượt tải</span>
                    {isExpired ? (
                      <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">Hết hạn</Badge>
                    ) : (
                      <Badge className="text-[10px] bg-success/10 text-success border-success/20">Còn hiệu lực</Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={!canDownload || loadingIds.has(dl.id)}
                  onClick={() => handleDownload(dl.id)}
                  className={`shrink-0 text-xs ${canDownload ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'opacity-50'}`}
                >
                  {loadingIds.has(dl.id) ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  {loadingIds.has(dl.id) ? 'Đang tải...' : canDownload ? `Tải (${remaining})` : 'Hết lượt'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export type { DownloadRecord }
