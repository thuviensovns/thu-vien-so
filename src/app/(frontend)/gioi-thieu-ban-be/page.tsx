'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Copy, CheckCircle2, Wallet, TrendingUp, Share2,
  Loader2, Gift, AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

interface MeResponse {
  enabled: boolean
  config: { commissionPercent: number; minWithdrawal: number }
  refCode?: string
  account?: {
    total_earned: string; available_balance: string; withdrawn: string; referral_count: number
    auto_credited: string
  }
  commissions?: Array<{
    id: number; source_type: string; base_amount: string; commission_amount: string
    commission_percent: string; status: string; created_at: string; referred_email: string | null
  }>
}

const fmt = (v: string | number) => Number(v).toLocaleString('vi-VN') + 'đ'

export default function UserAffiliatePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [data, setData] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [wdOpen, setWdOpen] = useState(false)
  const [wdAmount, setWdAmount] = useState('')
  const [wdBank, setWdBank] = useState('')
  const [wdAcct, setWdAcct] = useState('')
  const [wdHolder, setWdHolder] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/dang-nhap?next=/gioi-thieu-ban-be')
      return
    }
    if (user) {
      fetch('/api/affiliate/me', { credentials: 'include' })
        .then((r) => r.json())
        .then(setData)
        .finally(() => setLoading(false))
    }
  }, [user, isLoading, router])

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Đã copy')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleWithdraw() {
    const amount = Number(wdAmount)
    if (!amount || !wdBank || !wdAcct || !wdHolder) {
      toast.error('Vui lòng điền đầy đủ thông tin')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/affiliate/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount,
          bank_name: wdBank,
          bank_account_number: wdAcct,
          bank_account_holder: wdHolder,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        toast.success('Đã gửi yêu cầu rút tiền')
        setWdOpen(false)
        setWdAmount(''); setWdBank(''); setWdAcct(''); setWdHolder('')
        setLoading(true)
        const refreshed = await fetch('/api/affiliate/me', { credentials: 'include' })
        setData(await refreshed.json())
        setLoading(false)
      } else {
        toast.error(json.error || 'Không thể gửi yêu cầu')
      }
    } catch { toast.error('Lỗi mạng') }
    setSubmitting(false)
  }

  if (loading || isLoading) {
    return <div className="container py-12 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  }

  if (!data || !data.enabled) {
    return (
      <div className="container py-12 max-w-2xl">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="font-medium">Tính năng affiliate tạm thời chưa mở</p>
            <p className="text-sm text-muted-foreground mt-1">
              Vui lòng quay lại sau.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const refUrl = typeof window !== 'undefined' && data.refCode
    ? `${window.location.origin}/?ref=${data.refCode}`
    : ''
  const acct = data.account || { total_earned: '0', available_balance: '0', withdrawn: '0', referral_count: 0, auto_credited: '0' }
  const pendingBalance = Number(acct.available_balance)
  const canWithdraw = pendingBalance >= data.config.minWithdrawal
  const hasLegacyPending = pendingBalance > 0

  return (
    <div className="container py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          Giới thiệu bạn bè — Nhận {data.config.commissionPercent}%
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chia sẻ link giới thiệu. Mỗi khi bạn bè nạp tiền, bạn tự động nhận {data.config.commissionPercent}% vào số dư chính — không cần rút.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Đã cộng vào ví</p>
          <p className="text-lg font-bold text-success">{fmt(acct.auto_credited)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Tổng kiếm được</p>
          <p className="text-lg font-bold">{fmt(acct.total_earned)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Lượt giới thiệu</p>
          <p className="text-lg font-bold flex items-center gap-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            {acct.referral_count}
          </p>
        </CardContent></Card>
        {hasLegacyPending ? (
          <Card><CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Số dư chờ rút (cũ)</p>
            <p className="text-lg font-bold">{fmt(acct.available_balance)}</p>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Đã rút ngân hàng</p>
            <p className="text-lg font-bold">{fmt(acct.withdrawn)}</p>
          </CardContent></Card>
        )}
      </div>

      <Card className="bg-success/5 border-success/20">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
          <p className="text-xs">
            Hoa hồng tự động cộng vào số dư chính ngay khi bạn bè được mời nạp tiền — xem lịch sử trong mục Đơn hàng/Nạp tiền.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block flex items-center gap-1">
              <Share2 className="h-3.5 w-3.5" />
              Link giới thiệu của bạn
            </label>
            <div className="flex gap-2">
              <Input value={refUrl} readOnly className="font-mono text-xs" />
              <Button onClick={() => handleCopy(refUrl)} size="sm">
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Mã giới thiệu</label>
            <div className="flex gap-2">
              <Input value={data.refCode || ''} readOnly className="font-mono font-bold" />
              <Button onClick={() => handleCopy(data.refCode || '')} size="sm" variant="outline">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasLegacyPending ? (
        <>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          Rút tiền (số dư cũ)
        </h2>
        <Dialog open={wdOpen} onOpenChange={setWdOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!canWithdraw}>
              Gửi yêu cầu rút tiền
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yêu cầu rút tiền</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Số tiền (đ)</label>
                <Input
                  type="number"
                  min={data.config.minWithdrawal}
                  max={acct.available_balance}
                  value={wdAmount}
                  onChange={(e) => setWdAmount(e.target.value)}
                  placeholder={`Tối thiểu ${fmt(data.config.minWithdrawal)}`}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Khả dụng: {fmt(acct.available_balance)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Ngân hàng *</label>
                <Input value={wdBank} onChange={(e) => setWdBank(e.target.value)} placeholder="Vietcombank" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Số tài khoản *</label>
                <Input value={wdAcct} onChange={(e) => setWdAcct(e.target.value)} className="font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Chủ tài khoản *</label>
                <Input value={wdHolder} onChange={(e) => setWdHolder(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWdOpen(false)} disabled={submitting}>Hủy</Button>
              <Button onClick={handleWithdraw} disabled={submitting}>
                {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Gửi yêu cầu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {!canWithdraw && (
        <p className="text-xs text-muted-foreground">
          Cần ít nhất {fmt(data.config.minWithdrawal)} để rút.
        </p>
      )}
        </>
      ) : null}

      <div>
        <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Hoa hồng gần đây
        </h2>
        {(data.commissions || []).length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Chưa có hoa hồng nào
          </CardContent></Card>
        ) : (
          <div className="space-y-1">
            {data.commissions!.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/20 border border-border/40">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">{c.source_type}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {c.referred_email || 'người được giới thiệu'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {fmt(c.base_amount)} × {c.commission_percent}% · {new Date(c.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                <span className="text-sm font-semibold text-success shrink-0">+{fmt(c.commission_amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
