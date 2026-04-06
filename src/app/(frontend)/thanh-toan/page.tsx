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
import { formatVND } from '@/lib/format'
import { paymentMethods, buildVietQRUrl } from '@/lib/config'
import { useBankConfig } from '@/hooks/use-bank-config'
import { getDemoOrders, saveDemoOrders, logActivity, getCoupons, saveCoupons, type Coupon } from '@/lib/admin-helpers'
import { toast } from 'sonner'
import OrderSummary from './OrderSummary'
import BankTransferQR from './BankTransferQR'

const paymentIcons: Record<string, typeof CreditCard> = {
  vnpay: CreditCard, momo: CreditCard, 'bank-transfer': QrCode, 'balance': Wallet,
}

function generateDemoOrderNumber() {
  const d = new Date()
  const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `DH${ts}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, total, itemCount, clearCart } = useCart()
  const { balance } = useBalance()
  const bank = useBankConfig()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank-transfer')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null)
  const [couponError, setCouponError] = useState('')

  const discount = appliedCoupon
    ? appliedCoupon.type === 'percent'
      ? Math.round(total * appliedCoupon.value / 100)
      : Math.min(appliedCoupon.value, total)
    : 0
  const finalTotal = total - discount
  const canPayWithBalance = balance >= finalTotal && finalTotal > 0

  const orderNumber = useMemo(() => generateDemoOrderNumber(), [])
  const transferContent = `${orderNumber}`

  const qrUrl = useMemo(() => buildVietQRUrl(finalTotal, transferContent, bank), [finalTotal, transferContent, bank])

  const allPaymentMethods = useMemo(() => [
    {
      id: 'balance',
      name: 'Số dư tài khoản',
      description: `Số dư: ${formatVND(balance)}${!canPayWithBalance ? ' (không đủ)' : ''}`,
    },
    ...paymentMethods,
  ], [balance, canPayWithBalance])

  function handleApplyCoupon() {
    setCouponError('')
    const code = couponCode.trim().toUpperCase()
    if (!code) return
    const coupons = getCoupons()
    const coupon = coupons.find((c) => c.code.toUpperCase() === code)
    if (!coupon) { setCouponError('Mã giảm giá không tồn tại'); return }
    if (!coupon.active) { setCouponError('Mã giảm giá đã hết hiệu lực'); return }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) { setCouponError('Mã giảm giá đã hết hạn'); return }
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) { setCouponError('Mã giảm giá đã hết lượt sử dụng'); return }
    if (coupon.minOrder > 0 && total < coupon.minOrder) { setCouponError(`Đơn hàng tối thiểu ${formatVND(coupon.minOrder)}`); return }
    setAppliedCoupon(coupon)
    toast.success('Đã áp dụng mã giảm giá!')
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) return
    if (!agreedTerms) { setError('Vui lòng đồng ý với điều khoản sử dụng'); return }
    setError('')
    setIsSubmitting(true)

    function saveOrderToLocal(method: string, status: 'paid' | 'pending') {
      try {
        const existing = getDemoOrders()
        existing.unshift({
          id: `order-${Date.now()}`, orderNumber, email: email || 'guest',
          items: items.map((i) => ({ name: i.name, price: i.price })),
          total: finalTotal, method, status, createdAt: new Date().toISOString(),
          note: appliedCoupon ? `Mã giảm giá: ${appliedCoupon.code} (-${formatVND(discount)})` : undefined,
        })
        saveDemoOrders(existing)
        logActivity('order', `Đơn hàng mới — ${status === 'paid' ? 'Đã thanh toán' : 'Chờ xử lý'}`, `${orderNumber} — ${formatVND(finalTotal)}`)
      } catch {}
    }

    function consumeCoupon() {
      if (!appliedCoupon) return
      const coupons = getCoupons()
      const idx = coupons.findIndex((c) => c.id === appliedCoupon.id)
      if (idx !== -1) { coupons[idx].usedCount++; saveCoupons(coupons) }
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
            paymentMethod: 'balance', customerEmail: email, customerPhone: phone, customerName: fullName,
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

        consumeCoupon()
        saveOrderToLocal('Số dư TK', 'paid')
        try { localStorage.setItem('purchased_items', JSON.stringify(items)) } catch {}
        clearCart()
        setIsSubmitting(false)
        toast.success('Thanh toán thành công bằng số dư!')
        router.push(`/thanh-toan/ket-qua?status=success&orderNumber=${orderData.orderNumber || ''}`)
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
          paymentMethod, customerEmail: email, customerPhone: phone, customerName: fullName,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        consumeCoupon()
        // Bank-transfer stays pending until webhook confirms; VNPay redirects to payment gateway
        const orderStatus = paymentMethod === 'bank-transfer' ? 'pending' : 'paid'
        saveOrderToLocal(paymentMethod === 'bank-transfer' ? 'QR Bank' : paymentMethod, orderStatus)
        try { localStorage.setItem('purchased_items', JSON.stringify(items)) } catch {}
        clearCart()
        setIsSubmitting(false)
        if (data.paymentUrl) { window.location.href = data.paymentUrl }
        else {
          const resultStatus = paymentMethod === 'bank-transfer' ? 'pending' : 'success'
          router.push(`/thanh-toan/ket-qua?status=${resultStatus}&orderNumber=${data.orderNumber || ''}`)
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

              {/* Step 1: Contact info */}
              <Card className="border-border bg-card">
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</div>
                    <h2 className="font-bold">Thông tin liên hệ</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor="checkout-name" className="text-sm font-medium mb-1.5 block">Họ tên</label>
                      <Input id="checkout-name" type="text" placeholder="Nguyễn Văn A" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isSubmitting} className="bg-muted/50" />
                    </div>
                    <div>
                      <label htmlFor="checkout-email" className="text-sm font-medium mb-1.5 block">Email <span className="text-destructive">*</span></label>
                      <Input id="checkout-email" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} className="bg-muted/50" />
                      <p className="text-[10px] text-muted-foreground mt-1">Link download sẽ được gửi đến email này</p>
                    </div>
                    <div>
                      <label htmlFor="checkout-phone" className="text-sm font-medium mb-1.5 block">Số điện thoại</label>
                      <Input id="checkout-phone" type="tel" placeholder="0912 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isSubmitting} className="bg-muted/50" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 2: Payment method */}
              <Card className="border-border bg-card">
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</div>
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
                      <Input value={couponCode} onChange={(e) => { setCouponCode(e.target.value); setCouponError('') }} placeholder="Nhập mã giảm giá" className="bg-muted/50 font-mono uppercase" disabled={isSubmitting} />
                      <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={isSubmitting} className="shrink-0">Áp dụng</Button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                </CardContent>
              </Card>

              {/* Step 3: Confirm */}
              <Card className="border-border bg-card">
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</div>
                    <h2 className="font-bold">Xác nhận đơn hàng</h2>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} disabled={isSubmitting} className="accent-cyan-500 mt-0.5" />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      Tôi đồng ý với{' '}
                      <Link href="/dieu-khoan" className="text-primary hover:underline" target="_blank">điều khoản sử dụng</Link>{' '}
                      và <Link href="/chinh-sach-bao-mat" className="text-primary hover:underline" target="_blank">chính sách bảo mật</Link> của Thư Viện Số
                    </span>
                  </label>
                </CardContent>
              </Card>
            </div>

            {/* Order summary */}
            <OrderSummary
              items={items} itemCount={itemCount} total={total}
              discount={discount} finalTotal={finalTotal} orderNumber={orderNumber}
              couponCode={appliedCoupon?.code} paymentMethod={paymentMethod}
              isSubmitting={isSubmitting} agreedTerms={agreedTerms}
            />
          </div>
        </form>
      </div>
    </div>
  )
}
