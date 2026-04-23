'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ShoppingCart, Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/hooks/use-cart'
import { useAuth } from '@/hooks/use-auth'
import { useBalance } from '@/hooks/use-balance'
import { instantBuyWithBalance, buildDownloadResultUrl, stashInstantBuyResult } from '@/lib/instant-buy'
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
  const { addItem, removeItem, items } = useCart()
  const { user } = useAuth()
  const { balance, refreshBalance } = useBalance()
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

    // Not logged in — send to login, then back to this product page
    if (!user) {
      toast.info('Vui lòng đăng nhập để mua hàng')
      const back = typeof window !== 'undefined' ? window.location.pathname : '/'
      router.push(`/dang-nhap?redirect=${encodeURIComponent(back)}`)
      return
    }

    // Balance not enough — straight to top-up. User's explicit ask: never
    // route them through the bank-transfer checkout page just because the
    // wallet can't cover this single "Mua ngay" click.
    if (balance < price) {
      toast.info('Số dư chưa đủ, mời bạn nạp thêm tiền.')
      router.push('/nap-tien')
      return
    }

    // Balance covers — instant-buy, then jump straight to downloads.
    const toastId = 'instant-buy'
    toast.loading('Đang thanh toán bằng số dư...', { id: toastId, description: name })
    const result = await instantBuyWithBalance(id)
    if (result.ok) {
      toast.dismiss(toastId)
      stashInstantBuyResult(result.downloadToken, {
        orderNumber: result.orderNumber,
        items: result.downloadItems,
      })
      if (isInCart) removeItem(id)
      refreshBalance()
      router.push(buildDownloadResultUrl(result.orderNumber, result.downloadToken))
      return
    }
    toast.dismiss(toastId)
    if (result.reason === 'unauthorized') {
      toast.info('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
      const back = typeof window !== 'undefined' ? window.location.pathname : '/'
      router.push(`/dang-nhap?redirect=${encodeURIComponent(back)}`)
      return
    }
    if (result.reason === 'insufficient') {
      // Server disagreed with the local balance check — refresh and route to
      // top-up so the customer can add the shortfall.
      refreshBalance()
      toast.info(result.message || 'Số dư chưa đủ, mời bạn nạp thêm.')
      router.push('/nap-tien')
      return
    }
    toast.error(result.message || 'Thanh toán thất bại')
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
