'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Download, Eye, ShoppingCart, Check, Sparkles, Zap, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCart } from '@/hooks/use-cart'
import { useAuth } from '@/hooks/use-auth'
import { typeLabels } from '@/lib/config'
import { formatVND } from '@/lib/format'
import { deleteAdminProduct, getAdminProducts } from '@/lib/admin-helpers'
import { useState, memo, useMemo } from 'react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'

export interface ProductCardProps {
  id?: string
  name: string
  slug: string
  type: string
  thumbnail: string
  price: number
  originalPrice?: number | null
  isFree?: boolean
  downloadCount?: number
  bpm?: number | null
  musicalKey?: string | null
  featured?: boolean
  onDeleted?: () => void
}

export const ProductCard = memo(function ProductCard({
  id,
  name,
  slug,
  type,
  thumbnail,
  price,
  originalPrice,
  isFree,
  downloadCount = 0,
  bpm,
  musicalKey,
  featured,
  onDeleted,
}: ProductCardProps) {
  const { addItem, items } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const [justAdded, setJustAdded] = useState(false)
  const isAdmin = user?.role === 'admin'
  const isAdminProduct = useMemo(
    () => isAdmin ? getAdminProducts().some((p) => p.id === (id || slug)) : false,
    [isAdmin, id, slug],
  )
  const isInCart = items.some((i) => i.id === (id || slug))
  const isFreeItem = isFree || price === 0
  const hasDiscount = originalPrice && originalPrice > price
  const discountPercent = hasDiscount ? Math.round((1 - price / originalPrice) * 100) : 0

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (isInCart) return
    addItem({ id: id || slug, name, slug, price, thumbnail, type })
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1500)
    toast.success('Đã thêm vào giỏ hàng', {
      description: name,
      action: {
        label: 'Xem giỏ hàng',
        onClick: () => router.push('/gio-hang'),
      },
    })
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!id) return
    const confirmed = await confirmDialog({
      title: 'Xóa sản phẩm',
      description: `Bạn có chắc muốn xóa "${name}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa',
      variant: 'destructive',
    })
    if (!confirmed) return
    deleteAdminProduct(id)
    toast.success('Đã xóa sản phẩm', { description: name })
    onDeleted?.()
  }

  async function handleFreeDownload() {
    try {
      const res = await fetch('/api/download/free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id || slug }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          // External links (Google Drive, Mediafire, etc.) → open in new tab
          // R2 signed URLs → direct download
          const isExternal = data.url.startsWith('http') && !data.url.includes('.r2.cloudflarestorage.')
          if (isExternal) {
            window.open(data.url, '_blank', 'noopener')
          } else {
            const a = document.createElement('a')
            a.href = data.url
            a.download = data.fileName || `${slug}.zip`
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
          }
          router.refresh()
          return
        }
      }
      // No URL or API error — notify user
      toast.error('Chưa có file tải cho sản phẩm này', {
        description: 'Admin chưa thêm link tải. Vui lòng liên hệ hỗ trợ.',
      })
    } catch {
      toast.error('Lỗi kết nối', { description: 'Không thể tải xuống. Vui lòng thử lại.' })
    }
  }

  function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (isFreeItem) {
      handleFreeDownload()
      toast.success('Đang tải xuống...', { description: name })
      return
    }
    if (!isInCart) {
      addItem({ id: id || slug, name, slug, price, thumbnail, type })
    }
    router.push('/thanh-toan')
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-glow-sm hover:-translate-y-0.5">
      {/* Thumbnail */}
      <Link href={`/san-pham/${slug}`} className="block relative aspect-[4/3] overflow-hidden bg-muted/20">
        <Image
          src={thumbnail}
          alt={name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Quick view on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-medium scale-90 group-hover:scale-100 transition-transform duration-300">
            <Eye className="h-3.5 w-3.5" />
            Xem chi tiết
          </div>
        </div>

        {/* Top-left badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <Badge className="bg-black/60 backdrop-blur-sm border-0 text-white text-[10px] sm:text-xs px-2 py-0.5 font-medium">
            {typeLabels[type] || type}
          </Badge>
          {featured && (
            <Badge className="bg-gradient-to-r from-warning to-warning/80 border-0 text-warning-foreground text-[10px] sm:text-xs px-2 py-0.5 font-medium">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              Hot
            </Badge>
          )}
        </div>

        {/* Top-right: discount or free */}
        {isFreeItem ? (
          <div className="absolute top-2 right-2">
            <Badge className="bg-success border-0 text-success-foreground text-[10px] sm:text-xs px-2 py-0.5 font-bold">
              FREE
            </Badge>
          </div>
        ) : hasDiscount ? (
          <div className="absolute top-2 right-2">
            <Badge className="bg-destructive border-0 text-destructive-foreground text-[10px] sm:text-xs px-2 py-0.5 font-bold">
              -{discountPercent}%
            </Badge>
          </div>
        ) : null}

        {/* Admin delete button */}
        {isAdmin && isAdminProduct && (
          <button
            onClick={handleDelete}
            className="absolute bottom-2 right-2 z-10 h-7 w-7 rounded-full bg-destructive/90 backdrop-blur-sm flex items-center justify-center text-destructive-foreground hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100"
            aria-label={`Xóa sản phẩm ${name}`}
            title="Xóa sản phẩm"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Bottom badges: BPM / Key */}
        {(bpm || musicalKey) && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            {bpm && (
              <Badge variant="outline" className="bg-black/60 backdrop-blur-sm border-0 text-[10px] font-mono text-white px-1.5 py-0">
                {bpm} BPM
              </Badge>
            )}
            {musicalKey && (
              <Badge variant="outline" className="bg-black/60 backdrop-blur-sm border-0 text-[10px] font-mono text-secondary px-1.5 py-0">
                {musicalKey}
              </Badge>
            )}
          </div>
        )}
      </Link>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-3 sm:p-3.5">
        <Link href={`/san-pham/${slug}`}>
          <h3 className="font-semibold text-[13px] sm:text-sm line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-snug min-h-[2.2rem]">
            {name}
          </h3>
        </Link>

        {/* Price + downloads row */}
        <div className="mt-auto pt-2 flex items-end justify-between gap-1">
          <div className="flex flex-col">
            {isFreeItem ? (
              <span className="text-sm sm:text-base font-bold text-success">Miễn phí</span>
            ) : (
              <>
                {hasDiscount && (
                  <span className="text-[11px] text-muted-foreground line-through">{formatVND(originalPrice)}</span>
                )}
                <span className="text-sm sm:text-base font-bold text-primary">{formatVND(price)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
            <Download className="h-3 w-3" />
            <span>{downloadCount >= 1000 ? `${(downloadCount / 1000).toFixed(1)}K` : downloadCount}</span>
          </div>
        </div>

        {/* Action buttons */}
        {isFreeItem ? (
          <Button
            size="sm"
            onClick={handleBuyNow}
            className="mt-2.5 w-full text-xs h-8 rounded-lg font-medium bg-success/10 text-success hover:bg-success hover:text-success-foreground border border-success/20 transition-all duration-200"
          >
            <Download className="mr-1 h-3 w-3" />
            Tải miễn phí
          </Button>
        ) : (
          <div className="mt-2.5 flex gap-1.5">
            {/* Buy Now button */}
            <Button
              size="sm"
              onClick={handleBuyNow}
              className="flex-1 text-xs h-8 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
            >
              <Zap className="mr-1 h-3 w-3" />
              <span className="hidden sm:inline">Mua ngay</span>
              <span className="sm:hidden">Mua</span>
            </Button>

            {/* Add to Cart button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddToCart}
              disabled={isInCart}
              className={`h-8 w-8 sm:w-auto sm:px-2.5 rounded-lg transition-all duration-200 shrink-0 ${
                isInCart || justAdded
                  ? 'bg-success/10 text-success border-success/20'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
              }`}
            >
              {isInCart || justAdded ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <ShoppingCart className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
})
