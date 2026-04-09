'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ShoppingCart, Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/hooks/use-cart'
import { toast } from 'sonner'

interface AddToCartButtonProps {
  id: string
  name: string
  slug: string
  price: number
  thumbnail: string
  type: string
  isFree?: boolean
}

export function AddToCartButton({ id, name, slug, price, thumbnail, type, isFree }: AddToCartButtonProps) {
  const { addItem, items } = useCart()
  const router = useRouter()
  const [justAdded, setJustAdded] = useState(false)
  const isInCart = items.some((i) => i.id === id)

  async function handleFreeDownload() {
    toast.loading('Đang tải xuống...', { id: 'free-dl', description: name })
    try {
      const res = await fetch('/api/download/free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      })
      let data: { url?: string; fileName?: string; error?: string } | null = null
      try { data = await res.json() } catch {}

      if (res.ok && data?.url) {
        toast.dismiss('free-dl')
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
        toast.success('Tải xuống thành công!', { description: name })
        router.refresh()
        return
      }
      const errMsg = data?.error || (res.ok ? 'Chưa có file tải cho sản phẩm này' : `Lỗi server (${res.status})`)
      toast.error(errMsg, { id: 'free-dl' })
    } catch {
      toast.error('Lỗi kết nối', { id: 'free-dl', description: 'Không thể tải xuống. Vui lòng thử lại.' })
    }
  }

  async function handleAddToCart() {
    if (isFree) {
      await handleFreeDownload()
      return
    }
    if (isInCart) return
    addItem({ id, name, slug, price, thumbnail, type })
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 2000)
    toast.success('Đã thêm vào giỏ hàng', {
      description: name,
      action: {
        label: 'Xem giỏ hàng',
        onClick: () => router.push('/gio-hang'),
      },
    })
  }

  async function handleBuyNow() {
    if (isFree) {
      await handleFreeDownload()
      return
    }
    if (!isInCart) {
      addItem({ id, name, slug, price, thumbnail, type })
    }
    router.push('/thanh-toan')
  }

  if (isFree) {
    return (
      <Button
        size="lg"
        onClick={handleAddToCart}
        className="w-full bg-success text-white hover:bg-success shadow-glow-sm transition-all"
      >
        <Download className="mr-2 h-5 w-5" />
        Tải miễn phí
      </Button>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Buy Now - primary action */}
      <Button
        size="lg"
        onClick={handleBuyNow}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow transition-all"
      >
        <Zap className="mr-2 h-5 w-5" />
        Mua ngay
      </Button>

      {/* Add to Cart - secondary action */}
      <Button
        size="lg"
        variant="outline"
        onClick={handleAddToCart}
        disabled={isInCart}
        className={`w-full transition-all ${
          isInCart || justAdded
            ? 'bg-success/10 text-success border-success/20 hover:bg-success/15'
            : 'border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50'
        }`}
      >
        {isInCart || justAdded ? (
          <>
            <Check className="mr-2 h-5 w-5" />
            Đã thêm vào giỏ hàng
          </>
        ) : (
          <>
            <ShoppingCart className="mr-2 h-5 w-5" />
            Thêm vào giỏ hàng
          </>
        )}
      </Button>
    </div>
  )
}
