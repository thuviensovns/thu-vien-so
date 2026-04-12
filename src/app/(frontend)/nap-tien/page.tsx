'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Wallet, ChevronRight, QrCode, Copy, Check, Shield,
  AlertCircle, Sparkles, CheckCircle2, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { buildVietQRUrl, MIN_TOPUP } from '@/lib/config'
import { formatVND } from '@/lib/format'
import { useAuth } from '@/hooks/use-auth'
import { useBalance } from '@/hooks/use-balance'
import { useBankConfig } from '@/hooks/use-bank-config'
import { TopUpLeaderboard } from '@/components/shared/TopUpLeaderboard'
import { toast } from 'sonner'

const presetAmounts = [10000, 20000, 50000, 100000, 200000, 500000]
const POLL_INTERVAL = 5000
const POLL_TIMEOUT = 30 * 60 * 1000

/** Fixed transfer code per user for easy admin tracking */
function getUserTransferCode(userId: string): string {
  return `NAPKH${String(userId).padStart(4, '0')}`
}

export default function TopUpPage() {
  const { user } = useAuth()
  const { balance, refreshBalance } = useBalance()
  const bank = useBankConfig()
  const [amount, setAmount] = useState(50000)
  const [customAmount, setCustomAmount] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [polling, setPolling] = useState(false)
  const [topupCreated, setTopupCreated] = useState(false)
  const [authError, setAuthError] = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fixed transfer code per user — same code every time for admin tracking
  const transferCode = user ? getUserTransferCode(user.id) : ''

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])


  const finalAmount = useCustom ? (parseInt(customAmount) || 0) : amount
  const isValidAmount = finalAmount >= MIN_TOPUP

  const qrUrl = useMemo(
    () => isValidAmount ? buildVietQRUrl(finalAmount, transferCode, bank) : '',
    [finalAmount, transferCode, isValidAmount, bank],
  )

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      toast.success('Đã sao chép!')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Không thể sao chép')
    }
  }

  async function handleConfirmTopUp() {
    if (!isValidAmount || !user) return
    setConfirming(true)
    setAuthError(false)

    try {
      // Create pending top-up in DB (sends client transferCode for server validation)
      const res = await fetch('/api/topup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: finalAmount, transferCode }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          setAuthError(true)
          toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
        } else {
          toast.error(data.error || 'Không thể tạo yêu cầu nạp tiền')
        }
        setConfirming(false)
        return
      }

      const result = await res.json()
      setTopupCreated(true)
      setConfirming(false)
      toast.success('Đã xác nhận yêu cầu nạp tiền!', {
        description: 'Hệ thống sẽ tự động cập nhật khi nhận được tiền.',
      })

      // Start polling for webhook confirmation
      setPolling(true)
      const startTime = Date.now()
      const pollCode = result.transferCode || transferCode

      pollTimerRef.current = setInterval(async () => {
        if (Date.now() - startTime > POLL_TIMEOUT) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current)
          setPolling(false)
          toast.error('Hết thời gian chờ. Vui lòng liên hệ hỗ trợ nếu đã chuyển khoản.')
          return
        }

        try {
          const statusRes = await fetch(`/api/topup/status?code=${pollCode}`, {
            credentials: 'include',
          })
          if (statusRes.ok) {
            const statusData = await statusRes.json()
            if (statusData.status === 'completed') {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current)
              setPolling(false)
              setConfirmed(true)
              await refreshBalance()
              toast.success(`Nạp thành công ${formatVND(finalAmount)}!`)
            }
          }
        } catch {}
      }, POLL_INTERVAL)
    } catch {
      toast.error('Lỗi kết nối. Vui lòng thử lại.')
      setConfirming(false)
    }
  }

  function handleReset() {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    setConfirmed(false)
    setConfirming(false)
    setPolling(false)
    setTopupCreated(false)
    setAuthError(false)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/30">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">Trang chủ</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Nạp tiền</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-success" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Nạp tiền vào tài khoản</h1>
              <p className="text-xs text-muted-foreground">Nạp tiền để mua sản phẩm nhanh hơn</p>
            </div>
          </div>
          {user && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">Số dư hiện tại</p>
              <p className="text-lg font-bold text-success">{formatVND(balance)}</p>
            </div>
          )}
        </div>

        {!user && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-sm mb-6">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Bạn cần{' '}
              <Link href="/dang-nhap" className="underline font-medium">đăng nhập</Link>{' '}
              để nạp tiền vào tài khoản.
            </span>
          </div>
        )}

        {/* Auth error banner */}
        {authError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-6">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Phiên đăng nhập hết hạn.{' '}
              <Link href="/dang-nhap" className="underline font-medium">Đăng nhập lại</Link>{' '}
              để xác nhận nạp tiền tự động.
            </span>
          </div>
        )}

        {/* Success state */}
        {confirmed ? (
          <Card className="border-success/30 bg-success/5 max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-xl font-bold text-success">Nạp tiền thành công!</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Đã nạp {formatVND(finalAmount)} vào tài khoản
              </p>
              <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground">Số dư mới</p>
                <p className="text-2xl font-bold text-success">{formatVND(balance)}</p>
              </div>
              <div className="flex gap-3 mt-6 justify-center">
                <Button onClick={handleReset} variant="outline">Nạp thêm</Button>
                <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/san-pham">Mua sản phẩm</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Amount selection */}
            <div className="space-y-4">
              <Card className="border-border bg-card">
                <CardContent className="p-5 space-y-4">
                  <h2 className="font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Chọn số tiền nạp
                  </h2>

                  <div className="grid grid-cols-3 gap-2">
                    {presetAmounts.map((val) => (
                      <button
                        key={val}
                        type="button"
                        disabled={topupCreated}
                        onClick={() => { setAmount(val); setUseCustom(false) }}
                        className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                          !useCustom && amount === val
                            ? 'border-primary bg-primary/10 text-primary shadow-glow-sm'
                            : 'border-border hover:border-primary/30 text-foreground'
                        } ${topupCreated ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {formatVND(val)}
                      </button>
                    ))}
                  </div>

                  <Separator />

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Hoặc nhập số tiền khác</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Nhập số tiền (VND)"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value)
                          setUseCustom(true)
                        }}
                        onFocus={() => setUseCustom(true)}
                        min={MIN_TOPUP}
                        step={1000}
                        disabled={topupCreated}
                        className="bg-muted/50"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setUseCustom(false); setCustomAmount('') }}
                        disabled={topupCreated}
                        className="shrink-0"
                      >
                        Hủy
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Tối thiểu: {formatVND(MIN_TOPUP)}
                    </p>
                  </div>

                  {/* Selected amount display */}
                  <div className="p-3 rounded-lg bg-success/5 border border-success/20 text-center">
                    <p className="text-xs text-muted-foreground">Số tiền nạp</p>
                    <p className={`text-2xl font-bold ${isValidAmount ? 'text-success' : 'text-destructive'}`}>
                      {isValidAmount ? formatVND(finalAmount) : 'Chưa hợp lệ'}
                    </p>
                    {!isValidAmount && (
                      <p className="text-[10px] text-destructive mt-1">Tối thiểu {formatVND(MIN_TOPUP)}</p>
                    )}
                  </div>

                  {/* Action area */}
                  {user && isValidAmount && (
                    <>
                      {polling && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                          <span>Đang chờ xác nhận chuyển khoản... Hệ thống sẽ tự động cập nhật khi nhận được tiền.</span>
                        </div>
                      )}
                      <Button
                        onClick={handleConfirmTopUp}
                        disabled={confirming || topupCreated}
                        className="w-full bg-success text-white hover:bg-success/90"
                        size="lg"
                      >
                        {confirming ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang xử lý...
                          </>
                        ) : topupCreated ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang chờ xác nhận...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Xác nhận đã chuyển {formatVND(finalAmount)}
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Current balance - mobile */}
              {user && (
                <Card className="border-success/20 bg-success/5 sm:hidden">
                  <CardContent className="p-4 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Số dư hiện tại</span>
                    <span className="text-lg font-bold text-success">{formatVND(balance)}</span>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: QR Code — always shown when amount is valid */}
            <div>
              <Card className="border-border bg-card h-fit lg:sticky lg:top-[4.5rem]">
                <CardContent className="p-5 space-y-4">
                  <h2 className="font-bold flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />
                    Quét mã QR để nạp tiền
                  </h2>

                  {isValidAmount ? (
                    <>
                      {/* QR Image */}
                      <div className="flex justify-center">
                        <div className="bg-white rounded-xl p-3 shadow-sm">
                          <Image
                            src={qrUrl}
                            alt="QR Code nạp tiền"
                            width={220}
                            height={220}
                            className="rounded-lg"
                            unoptimized
                          />
                        </div>
                      </div>

                      {/* Bank details */}
                      <div className="space-y-2">
                        {[
                          { label: 'Ngân hàng', value: bank.bankName, key: 'bank' },
                          { label: 'Số tài khoản', value: bank.accountNumber, key: 'stk', mono: true, copyable: true },
                          { label: 'Chủ tài khoản', value: bank.accountName, key: 'name' },
                          { label: 'Số tiền', value: formatVND(finalAmount), key: 'amount', highlight: true },
                          { label: 'Nội dung CK', value: transferCode, key: 'code', mono: true, copyable: true, secondary: true },
                        ].map((row) => (
                          <div key={row.key} className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
                            <span className="text-muted-foreground text-xs">{row.label}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-semibold text-sm ${
                                row.highlight ? 'text-primary font-bold' :
                                row.secondary ? 'text-secondary font-mono' :
                                row.mono ? 'font-mono text-primary' : ''
                              }`}>
                                {row.value}
                              </span>
                              {row.copyable && (
                                <button
                                  type="button"
                                  onClick={() => copyText(row.value, row.key)}
                                  className="p-1 rounded hover:bg-muted/50 transition-colors"
                                >
                                  {copied === row.key
                                    ? <Check className="h-3 w-3 text-success" />
                                    : <Copy className="h-3 w-3 text-muted-foreground" />}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                        <Shield className="h-3 w-3 text-success" />
                        Giao dịch an toàn qua VietQR
                      </div>

                      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                        Mở app ngân hàng &rarr; Quét mã QR hoặc chuyển khoản thủ công.
                        Sau khi chuyển, nhấn &quot;Xác nhận đã chuyển&quot; để hệ thống tự động cập nhật số dư.
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <QrCode className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">Chọn số tiền để hiển thị mã QR</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Top-up Leaderboard */}
        <div className="mt-8">
          <TopUpLeaderboard />
        </div>
      </div>
    </div>
  )
}
