'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CreditCard, AlertCircle, ChevronRight, Lock, ShoppingCart, QrCode,
  Wallet, CheckCircle, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCart } from '@/hooks/use-cart'
import { useBalance } from '@/hooks/use-balance'
import { useAuth } from '@/hooks/use-auth'
import { formatVND } from '@/lib/format'
import { paymentMethods, buildVietQRUrl, getUserTransferCode } from '@/lib/config'
import { useBankConfig } from '@/hooks/use-bank-config'
import { toast } from 'sonner'
import OrderSummary from './OrderSummary'
import BankTransferQR from './BankTransferQR'

interface ApiCoupon {
  id: number
  code: string
  type: 'percent' | 'fixed'
  value: number
  minOrder: number
  maxUses: number
  usedCount: number
  discount: number
}

const paymentIcons: Record<string, typeof CreditCard> = {
  vnpay: CreditCard, momo: CreditCard, 'bank-transfer': QrCode, 'balance': Wallet,
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, total, itemCount, clearCart } = useCart()
  const { balance, refreshBalance } = useBalance()
  const { user } = useAuth()
  const bank = useBankConfig()
  const [paymentMethod, setPaymentMethod] = useState('bank-transfer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<ApiCoupon | null>(null)
  const [couponError, setCouponError] = useState('')
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)

  const discount = appliedCoupon?.discount || 0
  const finalTotal = total - discount
  const canPayWithBalance = balance >= finalTotal && finalTotal > 0

  // Same transfer code per user everywhere (topup + checkout)
  const transferContent = user ? getUserTransferCode(user.id) : ''

  const qrUrl = useMemo(() => buildVietQRUrl(finalTotal, transferContent, bank), [finalTotal, transferContent, bank])

  const allPaymentMethods = useMemo(() => {
    const methods = [
      {
        id: 'balance',
        name: 'Số dư tài khoản',
        description: `Số dư: ${formatVND(balance)}${!canPayWithBalance ? ' (không đủ)' : ''}`,
      },
      ...paymentMethods,
    ]
    // Bank transfer requires login for transfer code generation
    if (!user) return methods.filter((m) => m.id !== 'bank-transfer')
    return methods
  }, [balance, canPayWithBalance, user])

  async function handleApplyCoupon() {
    setCouponError('')
    const code = couponCode.trim().toUpperCase()
    if (!code) return
    setIsApplyingCoupon(true)
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(code)}&total=${total}`)
      const data = await res.json()
      if (!res.ok) {
        setCouponError(data.error || 'Mã giảm giá không hợp lệ')
        return
      }
      setAppliedCoupon(data as ApiCoupon)
      toast.success('Đã áp dụng mã giảm giá!')
    } catch {
      setCouponError('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) return
    setError('')
    setIsSubmitting(true)

    // Heads-up for users on Chrome/Edge/Firefox: after payment the site will
    // auto-trigger file downloads. If popups/downloads are blocked, a manual
    // "Tải" button appears on the result page. Toast stays until payment completes.
    toast.info('Sau khi thanh toán thành công, sản phẩm sẽ tự động tải về máy. Nếu trình duyệt chặn, hãy nhấn nút Tải xuống thủ công.', {
      duration: 6000,
    })

    async function consumeCoupon() {
      if (!appliedCoupon) return
      try {
        await fetch('/api/coupons/consume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: appliedCoupon.id }),
        })
      } catch {}
    }

    if (paymentMethod === 'balance') {
      if (!canPayWithBalance) {
        setError(`Số dư không đủ. Cần ${formatVND(finalTotal)}, hiện có ${formatVND(balance)}`)
        setIsSubmitting(false)
        return
      }
      try {
        // Step 1: Create order via API
        const createRes = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            items: items.map((i) => ({ productId: i.id, price: i.price })),
            paymentMethod: 'balance',
          }),
        })
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}))
          setError(err.error || 'Không thể tạo đơn hàng')
          setIsSubmitting(false)
          return
        }
        const orderData = await createRes.json()

        // Step 2: Pay with balance via API
        const payRes = await fetch('/api/payment/pay-with-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ orderId: orderData.orderId }),
        })
        if (!payRes.ok) {
          const err = await payRes.json().catch(() => ({}))
          setError(err.error || 'Thanh toán thất bại')
          setIsSubmitting(false)
          return
        }

        const payData = await payRes.json()
        await consumeCoupon()
        clearCart()
        refreshBalance()
        setIsSubmitting(false)
        toast.success('Thanh toán thành công bằng số dư!')
        const token = payData.downloadToken || ''
        router.push(`/thanh-toan/ket-qua?status=success&orderNumber=${payData.orderNumber || orderData.orderNumber || ''}&token=${token}`)
      } catch {
        setError('Lỗi kết nối. Vui lòng thử lại.')
        setIsSubmitting(false)
      }
      return
    }

    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.id, price: i.price })),
          paymentMethod,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        await consumeCoupon()
        // Bank-transfer stays pending until webhook confirms; VNPay redirects to payment gateway
        clearCart()
        setIsSubmitting(false)
        if (data.paymentUrl) { window.location.href = data.paymentUrl }
        else {
          const resultStatus = (paymentMethod === 'bank-transfer' || paymentMethod === 'momo') ? 'pending' : 'success'
          router.push(`/thanh-toan/ket-qua?status=${resultStatus}&orderNumber=${data.orderNumber || ''}&orderId=${data.orderId || ''}`)
        }
        return
      }
      // API returned error
      const errData = await res.json().catch(() => ({}))
      setError(errData.error || 'Không thể tạo đơn hàng. Vui lòng thử lại.')
      setIsSubmitting(false)
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.')
      setIsSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold">Giỏ hàng trống</h1>
        <p className="text-sm text-muted-foreground mt-2">Không có sản phẩm nào để thanh toán.</p>
        <Button asChild className="mt-4">
          <Link href="/san-pham"><ArrowLeft className="mr-2 h-4 w-4" />Quay lại cửa hàng</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card/30">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/gio-hang" className="hover:text-primary transition-colors">Giỏ hàng</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Thanh toán</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Thanh toán</h1>
            <p className="text-xs text-muted-foreground">Hoàn tất đơn hàng của bạn</p>
          </div>
        </div>

        <form onSubmit={handleCheckout}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* Checkout form */}
            <div className="lg:col-span-3 space-y-4 sm:space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}

              {/* Step 1: Payment method */}
              <Card className="border-border bg-card">
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</div>
                    <h2 className="font-bold">Phương thức thanh toán</h2>
                  </div>
                  <div className="space-y-2">
                    {allPaymentMethods.map((method) => {
                      const Icon = paymentIcons[method.id] || CreditCard
                      const isBalance = method.id === 'balance'
                      const isDisabled = isBalance && !canPayWithBalance
                      return (
                        <label
                          key={method.id}
                          className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-all ${
                            isDisabled ? 'border-border opacity-50 cursor-not-allowed'
                              : paymentMethod === method.id ? 'border-primary bg-primary/5 shadow-glow-sm cursor-pointer'
                              : 'border-border hover:border-primary/30 cursor-pointer'
                          }`}
                        >
                          <input type="radio" name="payment" value={method.id} checked={paymentMethod === method.id} onChange={(e) => setPaymentMethod(e.target.value)} disabled={isSubmitting || isDisabled} className="accent-cyan-500" />
                          <Icon className={`h-5 w-5 shrink-0 ${isBalance ? 'text-success' : 'text-primary'}`} />
                          <div className="flex-1">
                            <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                              {method.name}
                              {isBalance && canPayWithBalance && <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Nhanh nhất</Badge>}
                              {isBalance && !canPayWithBalance && <Link href="/nap-tien" className="text-[10px] text-primary hover:underline">Nạp thêm →</Link>}
                              {method.id === 'bank-transfer' && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Khuyên dùng</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">{method.description}</div>
                          </div>
                          {paymentMethod === method.id && !isDisabled && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                        </label>
                      )
                    })}
                  </div>

                  {paymentMethod === 'bank-transfer' && (
                    <BankTransferQR qrUrl={qrUrl} bank={bank} finalTotal={finalTotal} transferContent={transferContent} />
                  )}

                  {paymentMethod === 'momo' && (
                    <div className="mt-4 p-4 rounded-xl border border-pink-500/20 bg-pink-500/5">
                      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                        <div className="shrink-0 bg-white rounded-lg p-2 shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/images/momo-qr.png" alt="QR MoMo" width={200} height={200} className="rounded" />
                        </div>
                        <div className="flex-1 space-y-2.5 text-sm w-full">
                          <h3 className="font-bold text-base flex items-center gap-2">
                            <QrCode className="h-4 w-4 text-pink-500" />
                            Thanh toán qua MoMo
                          </h3>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                              <span className="text-muted-foreground text-xs">Số tiền</span>
                              <span className="font-bold text-pink-500">{formatVND(finalTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                              <span className="text-muted-foreground text-xs">Nội dung CK</span>
                              <span className="font-mono font-bold text-secondary">{transferContent}</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
                            Quét mã QR bằng app MoMo, nhập đúng số tiền và nội dung chuyển khoản.
                            Đơn hàng sẽ được xử lý sau khi admin xác nhận thanh toán.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'balance' && canPayWithBalance && (
                    <div className="mt-4 p-4 rounded-xl border border-success/20 bg-success/5">
                      <div className="flex items-center gap-3">
                        <Wallet className="h-8 w-8 text-success shrink-0" />
                        <div>
                          <p className="font-semibold text-sm">Thanh toán bằng số dư</p>
                          <p className="text-xs text-muted-foreground">
                            Số dư hiện tại: <span className="text-success font-bold">{formatVND(balance)}</span>
                            {' → '}Sau thanh toán: <span className="font-bold">{formatVND(balance - finalTotal)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Coupon */}
              <Card className="border-border bg-card">
                <CardContent className="p-4 sm:p-6 space-y-3">
                  <h2 className="font-bold text-sm">Mã giảm giá</h2>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
                      <div>
                        <span className="font-mono font-bold text-success">{appliedCoupon.code}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          -{appliedCoupon.type === 'percent' ? `${appliedCoupon.value}%` : formatVND(appliedCoupon.value)}
                        </span>
                      </div>
                      <button type="button" onClick={handleRemoveCoupon} className="text-xs text-destructive hover:underline">Xóa</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input value={couponCode} onChange={(e) => { setCouponCode(e.target.value); setCouponError('') }} placeholder="Nhập mã giảm giá" className="bg-muted/50 font-mono uppercase" disabled={isSubmitting || isApplyingCoupon} />
                      <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={isSubmitting || isApplyingCoupon} className="shrink-0">{isApplyingCoupon ? 'Đang KT...' : 'Áp dụng'}</Button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                </CardContent>
              </Card>

            </div>

            {/* Order summary */}
            <OrderSummary
              items={items} itemCount={itemCount} total={total}
              discount={discount} finalTotal={finalTotal} transferContent={transferContent}
              couponCode={appliedCoupon?.code} paymentMethod={paymentMethod}
              isSubmitting={isSubmitting}
            />
          </div>
        </form>
      </div>
    </div>
  )
}
