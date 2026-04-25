'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Wallet, Plus, Search, CheckCircle2, Clock, XCircle,
  ArrowUpCircle, RefreshCw, Loader2, TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatVND, formatDate } from '@/lib/format'
import { toast } from 'sonner'

interface TopUpEntry {
  id: number
  userEmail: string
  userName: string | null
  userId: number | null
  amount: number
  transferCode: string
  status: 'completed' | 'pending' | 'failed' | 'expired'
  bankTransactionId?: string | null
  bankDescription?: string | null
  confirmedAt?: string | null
  createdAt: string
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  completed: { label: 'Hoàn thành', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10 border-success/20' },
  pending: { label: 'Chờ xử lý', icon: Clock, color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  failed: { label: 'Thất bại', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
  expired: { label: 'Hết hạn', icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted/10 border-muted/20' },
}

export default function TopUpManagementPage() {
  const [history, setHistory] = useState<TopUpEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchTopUps = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/admin/topups?${params}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setHistory(data.docs || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    fetchTopUps()
  }, [fetchTopUps])

  // Auto-refresh every 15s to catch new topups
  useEffect(() => {
    const interval = setInterval(fetchTopUps, 15000)
    return () => clearInterval(interval)
  }, [fetchTopUps])

  // "Tổng nạp" hiển thị doanh thu thật (gross): loại DEDUCT* (admin trừ tiền,
  // điều chỉnh nội bộ) và COMM* (hoa hồng affiliate). Các DEDUCT row vẫn
  // xuất hiện trong list để admin theo dõi nhưng không cộng/trừ vào tổng.
  const totalCompleted = history
    .filter((h) =>
      h.status === 'completed' &&
      !(h.transferCode || '').startsWith('DEDUCT') &&
      !(h.transferCode || '').startsWith('COMM'),
    )
    .reduce((s, h) => s + h.amount, 0)
  const totalPending = history.filter((h) => h.status === 'pending').length

  async function handleManualTopUp() {
    if (!formEmail.trim() || !formAmount) {
      toast.error('Vui lòng nhập email và số tiền')
      return
    }
    const amount = parseInt(formAmount)
    if (isNaN(amount) || amount < 1000) {
      toast.error('Số tiền tối thiểu 1.000₫')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/topups', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail.trim(), amount }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Lỗi nạp tiền')
        setSaving(false)
        return
      }

      toast.success(`Đã nạp ${formatVND(amount)} cho ${data.userName || formEmail}`, {
        description: `Số dư mới: ${formatVND(data.newBalance)}`,
      })
      setFormEmail('')
      setFormAmount('')
      setShowAddForm(false)
      fetchTopUps() // Refresh list
    } catch {
      toast.error('Lỗi kết nối')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-success" />
            Quản lý nạp tiền
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {history.length} giao dịch — Tổng: {formatVND(totalCompleted)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/quan-ly/nap-tien/doanh-thu">
            <Button size="sm" variant="outline" title="Xem doanh thu theo ngày/tháng/năm">
              <TrendingUp className="mr-1.5 h-3.5 w-3.5 text-success" />
              Doanh thu
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={fetchTopUps} title="Làm mới">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nạp thủ công
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Tổng nạp</p>
            <p className="text-lg font-bold text-success">{formatVND(totalCompleted)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Giao dịch</p>
            <p className="text-lg font-bold">{history.length}</p>
          </CardContent>
        </Card>
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Chờ xử lý</p>
            <p className="text-lg font-bold text-warning">{totalPending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Manual top-up form */}
      {showAddForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-primary" />
              Nạp tiền thủ công cho người dùng
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Email người dùng</label>
                <Input
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="bg-muted/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Số tiền (VND)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formAmount ? Number(formAmount).toLocaleString('vi-VN') : ''}
                  onChange={(e) => setFormAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="50.000"
                  className="bg-muted/50 font-mono"
                />
                {formAmount && Number(formAmount) > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono mt-1 block">
                    = {formatVND(Number(formAmount))}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleManualTopUp} disabled={saving}>
                {saving ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Đang xử lý...</>
                ) : (
                  <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Xác nhận nạp</>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { value: 'all', label: 'Tất cả' },
          { value: 'pending', label: 'Chờ xử lý' },
          { value: 'completed', label: 'Hoàn thành' },
          { value: 'failed', label: 'Thất bại' },
          { value: 'expired', label: 'Hết hạn' },
        ].map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={statusFilter === tab.value ? 'default' : 'outline'}
            className="text-xs h-7 px-2.5"
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo mã giao dịch, nội dung CK, mã ngân hàng..."
          className="pl-9 bg-muted/50"
        />
      </div>

      {/* History list */}
      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Đang tải...</p>
        </div>
      ) : history.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Chưa có giao dịch nạp tiền</p>
            <p className="text-xs text-muted-foreground mt-1">Giao dịch sẽ xuất hiện khi người dùng nạp tiền tại /nap-tien</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => {
            const st = statusConfig[entry.status] || statusConfig.pending
            const StatusIcon = st.icon
            const isDeduct = entry.amount < 0 || entry.transferCode?.startsWith('DEDUCT')
            return (
              <Card key={entry.id} className={`border-border ${isDeduct ? 'bg-destructive/5' : 'bg-card'}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <StatusIcon className={`h-5 w-5 shrink-0 ${isDeduct ? 'text-destructive' : st.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {entry.userName || entry.userEmail}
                      </p>
                      <Badge variant="outline" className={`text-[10px] ${st.bg} ${st.color}`}>
                        {st.label}
                      </Badge>
                      {isDeduct && (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                          Trừ tiền
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span className="font-mono">{entry.transferCode}</span>
                      <span>•</span>
                      <span>{entry.userEmail}</span>
                      <span>•</span>
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                    {entry.bankDescription && (
                      <p className="text-[11px] text-muted-foreground mt-1 bg-muted/50 px-2 py-0.5 rounded font-mono truncate">
                        ND: {entry.bankDescription}
                      </p>
                    )}
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${isDeduct ? 'text-destructive' : 'text-success'}`}>
                    {isDeduct ? '−' : '+'}{formatVND(Math.abs(entry.amount))}
                  </span>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
