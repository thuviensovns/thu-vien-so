'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Settings as SettingsIcon, CreditCard, TrendingUp,
  Save, Loader2, CheckCircle2, XCircle, Clock,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Config {
  enabled: boolean
  commissionPercent: number
  minWithdrawal: number
  creditSources: ('topup' | 'order')[]
}
interface Account {
  user_id: number; ref_code: string; email: string | null; display_name: string | null
  total_earned: string; available_balance: string; withdrawn: string; referral_count: number
}
interface Commission {
  id: number; source_type: string; base_amount: string; commission_amount: string
  commission_percent: string; status: string; created_at: string
  referrer_email: string | null; referred_email: string | null
}
interface Withdrawal {
  id: number; user_id: number; amount: string; bank_name: string | null
  bank_account_number: string | null; bank_account_holder: string | null
  status: 'pending' | 'approved' | 'rejected'; admin_note: string | null
  processed_by: string | null; processed_at: string | null; created_at: string
  email: string | null; display_name: string | null
}

const fmt = (v: string | number) => Number(v).toLocaleString('vi-VN') + 'đ'

export default function AffiliateAdminPage() {
  const [tab, setTab] = useState<'config' | 'accounts' | 'commissions' | 'withdrawals'>('config')
  const [config, setConfig] = useState<Config>({
    enabled: false, commissionPercent: 5, minWithdrawal: 50_000, creditSources: ['topup'],
  })
  const [accounts, setAccounts] = useState<Account[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [wdFilter, setWdFilter] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, acctRes, commRes, wdRes] = await Promise.all([
        fetch('/api/admin/affiliate/config', { credentials: 'include' }),
        fetch('/api/admin/affiliate/accounts', { credentials: 'include' }),
        fetch('/api/admin/affiliate/commissions', { credentials: 'include' }),
        fetch(`/api/admin/affiliate/withdrawals?status=${wdFilter}`, { credentials: 'include' }),
      ])
      if (cfgRes.ok) setConfig(await cfgRes.json())
      if (acctRes.ok) setAccounts((await acctRes.json()).docs || [])
      if (commRes.ok) setCommissions((await commRes.json()).docs || [])
      if (wdRes.ok) setWithdrawals((await wdRes.json()).docs || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [wdFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleSaveConfig() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/affiliate/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      })
      if (res.ok) toast.success('Đã lưu cấu hình')
      else toast.error('Không thể lưu')
    } catch { toast.error('Lỗi mạng') }
    setSaving(false)
  }

  async function handleWithdrawalAction(id: number, status: 'approved' | 'rejected') {
    const note = prompt(`Ghi chú ${status === 'approved' ? 'phê duyệt' : 'từ chối'} (tuỳ chọn):`, '')
    if (note === null) return
    try {
      const res = await fetch('/api/admin/affiliate/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, status, admin_note: note }),
      })
      if (res.ok) {
        toast.success(`Đã ${status === 'approved' ? 'phê duyệt' : 'từ chối'}`)
        fetchAll()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Lỗi')
      }
    } catch { toast.error('Lỗi mạng') }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          Affiliate (Giới thiệu ăn %)
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {config.enabled ? 'Đang hoạt động' : 'Đang tắt'} · {config.commissionPercent}% / nạp
        </p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {([
          ['config', 'Cấu hình', SettingsIcon],
          ['accounts', `Tài khoản (${accounts.length})`, Users],
          ['commissions', `Hoa hồng (${commissions.length})`, TrendingUp],
          ['withdrawals', `Rút tiền (${withdrawals.filter((w) => w.status === 'pending').length})`, CreditCard],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="inline h-3.5 w-3.5 mr-1.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === 'config' ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <input
                id="enabled"
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="enabled" className="text-sm font-medium cursor-pointer">
                Bật tính năng affiliate
              </label>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Phần trăm hoa hồng (0-50%)</label>
              <Input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={config.commissionPercent}
                onChange={(e) => setConfig({ ...config, commissionPercent: Number(e.target.value) })}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Ví dụ: 5% → người giới thiệu nhận 5,000đ cho mỗi 100,000đ referee nạp/mua.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Số tiền rút tối thiểu (đ)</label>
              <Input
                type="number"
                min="0"
                step="10000"
                value={config.minWithdrawal}
                onChange={(e) => setConfig({ ...config, minWithdrawal: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Tính hoa hồng khi:</label>
              <div className="space-y-1">
                {(['topup', 'order'] as const).map((src) => (
                  <label key={src} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.creditSources.includes(src)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...config.creditSources, src]
                          : config.creditSources.filter((s) => s !== src)
                        setConfig({ ...config, creditSources: next.length === 0 ? ['topup'] : next })
                      }}
                      className="h-4 w-4"
                    />
                    {src === 'topup' ? 'Nạp tiền' : 'Đơn hàng thanh toán'}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveConfig} disabled={saving} size="sm">
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Lưu cấu hình
            </Button>
          </CardContent>
        </Card>
      ) : tab === 'accounts' ? (
        accounts.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Chưa có tài khoản affiliate
          </CardContent></Card>
        ) : (
          <div className="space-y-1">
            {accounts.map((a) => (
              <Card key={a.user_id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.display_name || a.email}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      <code className="bg-muted/50 px-1 rounded">{a.ref_code}</code> · {a.referral_count} lượt giới thiệu
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Số dư</p>
                    <p className="text-sm font-semibold text-success">{fmt(a.available_balance)}</p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-xs text-muted-foreground">Tổng kiếm</p>
                    <p className="text-sm">{fmt(a.total_earned)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : tab === 'commissions' ? (
        commissions.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Chưa có hoa hồng nào
          </CardContent></Card>
        ) : (
          <div className="space-y-1">
            {commissions.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/20 border border-border/40">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">{c.source_type}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    <span className="font-medium">{c.referrer_email}</span>
                    {' ← '}
                    <span className="text-muted-foreground">{c.referred_email}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {fmt(c.base_amount)} × {c.commission_percent}% · {new Date(c.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                <span className="text-sm font-semibold text-success shrink-0">+{fmt(c.commission_amount)}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="flex gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setWdFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  wdFilter === s
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'all' ? 'Tất cả' : s}
              </button>
            ))}
          </div>
          {withdrawals.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
              Chưa có yêu cầu rút tiền
            </CardContent></Card>
          ) : (
            <div className="space-y-1">
              {withdrawals.map((w) => (
                <Card key={w.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                        w.status === 'approved' ? 'bg-success/10' :
                        w.status === 'rejected' ? 'bg-destructive/10' : 'bg-warning/10'
                      }`}>
                        {w.status === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> :
                         w.status === 'rejected' ? <XCircle className="h-3.5 w-3.5 text-destructive" /> :
                         <Clock className="h-3.5 w-3.5 text-warning" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{w.display_name || w.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {w.bank_name} · {w.bank_account_number} · {w.bank_account_holder}
                        </p>
                        {w.admin_note && <p className="text-[10px] text-muted-foreground mt-0.5">Note: {w.admin_note}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{fmt(w.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(w.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    {w.status === 'pending' && (
                      <div className="flex gap-2 mt-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleWithdrawalAction(w.id, 'rejected')}>
                          Từ chối
                        </Button>
                        <Button size="sm" onClick={() => handleWithdrawalAction(w.id, 'approved')}>
                          Phê duyệt
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
