'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Trash2, ShoppingCart, ArrowRight, ArrowLeft, Shield, Zap, Clock, Package } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { formatVND } from '@/lib/format'
import { typeLabels } from '@/lib/config'
import { toast } from 'sonner'

export default function CartPage() {
  const { items, removeItem, clearCart, total, itemCount } = useCart()
  const { user } = useAuth()
  const router = useRouter()

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 sm:py-20 text-center">
        <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <ShoppingCart className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold">Giỏ hàng trống</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
          Hãy thêm sản phẩm vào giỏ hàng để bắt đầu mua sắm
        </p>
        <Button asChild className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/san-pham">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Khám phá sản phẩm
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Giỏ hàng
            <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              {itemCount}
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {itemCount} sản phẩm trong giỏ hàng
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { clearCart(); toast.info('Đã xóa giỏ hàng') }}
          className="text-muted-foreground hover:text-destructive text-xs"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Xóa tất cả
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-2 sm:space-y-3">
          {items.map((item, index) => (
            <Card key={item.id} className="border-border bg-card hover:border-border/80 transition-colors">
              <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                {/* Number */}
                <span className="text-xs text-muted-foreground font-mono w-5 text-center shrink-0 hidden sm:block">
                  {index + 1}
                </span>

                {/* Thumbnail */}
                <Link href={`/san-pham/${item.slug}`} className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden shrink-0 bg-muted/30 border border-border/50">
                  <Image
                    src={item.thumbnail || '/images/placeholder.jpg'}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/san-pham/${item.slug}`}
                    className="font-medium text-sm hover:text-primary transition-colors line-clamp-1"
                  >
                    {item.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                      {typeLabels[item.type] || item.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">x1</span>
                  </div>
                </div>

                {/* Price */}
                <span className="font-bold text-primary text-sm whitespace-nowrap">
                  {formatVND(item.price)}
                </span>

                {/* Remove */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    removeItem(item.id)
                    toast.info('Đã xóa khỏi giỏ hàng', { description: item.name })
                  }}
                  aria-label={`Xóa ${item.name} khỏi giỏ hàng`}
                  className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Continue shopping */}
          <div className="pt-2">
            <Link href="/san-pham" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>

        {/* Order summary */}
        <div className="space-y-4">
          <Card className="border-border bg-card h-fit lg:sticky lg:top-[4.5rem]">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Tóm tắt đơn hàng
              </h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Số lượng</span>
                  <span>{itemCount} sản phẩm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tạm tính</span>
                  <span>{formatVND(total)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatVND(total)}</span>
              </div>

              {/* Checkout button */}
              <Button
                size="lg"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow-sm"
                onClick={() => {
                  if (!user) {
                    toast.info('Vui lòng đăng nhập để mua hàng')
                    router.push('/dang-nhap?redirect=/thanh-toan')
                    return
                  }
                  router.push('/thanh-toan')
                }}
              >
                <Zap className="mr-2 h-4 w-4" />
                Thanh toán {formatVND(total)}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              {/* Trust signals */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-success shrink-0" />
                  <span>Thanh toán an toàn & bảo mật</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Nhận link download ngay sau khi thanh toán</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                  <span>Hỗ trợ kỹ thuật 24/7</span>
                </div>
              </div>

              {/* Payment badges */}
              <div className="flex justify-center gap-2 pt-1">
                <Badge variant="outline" className="text-[10px]">QR Bank</Badge>
                <Badge variant="outline" className="text-[10px]">Số dư TK</Badge>
                <Badge variant="outline" className="text-[10px]">VNPay</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
