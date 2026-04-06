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

  function triggerDemoDownload() {
    const content = [
      '=== Thư Viện Số ===',
      '',
      `Sản phẩm: ${name}`,
      `Loại: ${type}`,
      '',
      'Cảm ơn bạn đã tải sản phẩm miễn phí!',
      '',
      'Lưu ý: Đây là file xác nhận. File sản phẩm thực tế',
      'sẽ có khi kết nối database.',
      '',
      'Hỗ trợ: support.thuvienso@gmail.com',
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}-free.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFreeDownload() {
    try {
      const res = await fetch('/api/download/free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.open(data.url, '_blank')
        } else {
          // No R2 file — use demo download but count was already incremented
          triggerDemoDownload()
        }
        // Refresh page to show updated download count
        router.refresh()
        return
      }
    } catch {}
    // Fallback demo download (API unavailable)
    triggerDemoDownload()
  }

  function handleAddToCart() {
    if (isFree) {
      handleFreeDownload()
      toast.success('Đang tải xuống...', { description: name })
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

  function handleBuyNow() {
    if (isFree) {
      handleFreeDownload()
      toast.success('Đang tải xuống...', { description: name })
      return
    }
    // Add to cart then redirect to checkout
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
