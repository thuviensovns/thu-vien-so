'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ShoppingCart, Shield, CreditCard, Zap, Wallet,
  CheckCircle, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatVND } from '@/lib/format'
import { typeLabels } from '@/lib/config'
import type { CartItem } from '@/hooks/use-cart'

interface OrderSummaryProps {
  items: CartItem[]
  itemCount: number
  total: number
  discount: number
  finalTotal: number
  transferContent: string
  couponCode?: string
  paymentMethod: string
  isSubmitting: boolean
}

export default function OrderSummary({
  items, itemCount, total, discount, finalTotal,
  transferContent, couponCode, paymentMethod, isSubmitting,
}: OrderSummaryProps) {
  return (
    <div className="lg:col-span-2">
      <div className="border border-border bg-card rounded-xl h-fit lg:sticky lg:top-[4.5rem] p-5 sm:p-6 space-y-4">
        <h2 className="font-bold flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Đơn hàng ({itemCount})
        </h2>

        {/* Transfer content */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
          <span className="text-xs text-muted-foreground">Nội dung CK:</span>
          <span className="font-mono text-xs font-bold text-primary">{transferContent}</span>
        </div>

        {/* Item list */}
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-lg overflow-hidden shrink-0 bg-muted/30 border border-border/50">
                <Image
                  src={item.thumbnail || '/images/placeholder.jpg'}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">{typeLabels[item.type] || item.type}</p>
              </div>
              <span className="text-sm font-bold text-primary whitespace-nowrap">{formatVND(item.price)}</span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tạm tính ({itemCount} sp)</span>
            <span>{formatVND(total)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Giảm giá ({couponCode})</span>
              <span className="text-success">-{formatVND(discount)}</span>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex justify-between font-bold text-lg">
          <span>Tổng thanh toán</span>
          <span className="text-primary">{formatVND(finalTotal)}</span>
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow-sm disabled:opacity-50"
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang xử lý...</>
          ) : paymentMethod === 'balance' ? (
            <><Wallet className="mr-2 h-4 w-4" />Thanh toán bằng số dư</>
          ) : paymentMethod === 'bank-transfer' ? (
            <><CheckCircle className="mr-2 h-4 w-4" />Đã chuyển khoản — Xác nhận</>
          ) : (
            <><Zap className="mr-2 h-4 w-4" />Thanh toán {formatVND(finalTotal)}</>
          )}
        </Button>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
            <Shield className="h-3 w-3 text-success" />
            Giao dịch được mã hóa SSL 256-bit
          </div>
          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
            <CreditCard className="h-3 w-3" />
            Hỗ trợ QR Bank, Số dư TK, VNPay
          </div>
        </div>

        <Separator />

        <Link href="/gio-hang" className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors">
          ← Quay lại giỏ hàng
        </Link>
      </div>
    </div>
  )
}
