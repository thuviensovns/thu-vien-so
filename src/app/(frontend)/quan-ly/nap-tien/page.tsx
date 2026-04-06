'use client'

import { useState, useMemo } from 'react'
import {
  Wallet, Plus, Search, CheckCircle2, Clock, XCircle,
  ArrowUpCircle, AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatVND, formatDate } from '@/lib/format'
import { getTopUpHistory, saveTopUpEntry, getDemoUsers, saveDemoUsers, logActivity } from '@/lib/admin-helpers'
import { toast } from 'sonner'

const statusConfig = {
  completed: { label: 'Hoàn thành', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10 border-success/20' },
  pending: { label: 'Chờ xử lý', icon: Clock, color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  rejected: { label: 'Từ chối', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
}

export default function TopUpManagementPage() {
  const [history, setHistory] = useState(() => getTopUpHistory())
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formAmount, setFormAmount] = useState('')

  const filtered = useMemo(() => {
    if (!search) return history
    const q = search.toLowerCase()
    return history.filter((h) =>
      h.userEmail.toLowerCase().includes(q) ||
      h.transferCode.toLowerCase().includes(q)
    )
  }, [history, search])

  const totalCompleted = history.filter((h) => h.status === 'completed').reduce((s, h) => s + h.amount, 0)
  const totalPending = history.filter((h) => h.status === 'pending').length

  function handleManualTopUp() {
    if (!formEmail.trim() || !formAmount) {
      toast.error('Vui lòng nhập email và số tiền')
      return
    }
    const amount = parseInt(formAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Số tiền không hợp lệ')
      return
    }

    saveTopUpEntry({
      userId: 'manual',
      userEmail: formEmail.trim(),
      amount,
      method: 'Admin cộng thủ công',
      status: 'completed',
      transferCode: `ADMIN${Date.now().toString(36).toUpperCase()}`,
    })

    // Actually credit the user's balance in demo_users
    const users = getDemoUsers()
    const userIdx = users.findIndex((u) => u.email === formEmail.trim())
    if (userIdx !== -1) {
      users[userIdx] = { ...users[userIdx], balance: (users[userIdx].balance || 0) + amount }
      saveDemoUsers(users)
    }

    toast.success(`Đã nạp ${formatVND(amount)} cho ${formEmail}`)
    setHistory(getTopUpHistory())
    setFormEmail('')
    setFormAmount('')
    setShowAddForm(false)
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
        <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nạp thủ công
        </Button>
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
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="50000"
                  className="bg-muted/50 font-mono"
                  min={1000}
                  step={1000}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleManualTopUp}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Xác nhận nạp
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo email hoặc mã giao dịch..."
          className="pl-9 bg-muted/50"
        />
      </div>

      {/* History list */}
      {filtered.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Chưa có giao dịch nạp tiền</p>
            <p className="text-xs text-muted-foreground mt-1">Giao dịch sẽ xuất hiện khi người dùng nạp tiền tại /nap-tien</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const st = statusConfig[entry.status]
            const StatusIcon = st.icon
            return (
              <Card key={entry.id} className="border-border bg-card">
                <CardContent className="p-3 flex items-center gap-3">
                  <StatusIcon className={`h-5 w-5 shrink-0 ${st.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{entry.userEmail}</p>
                      <Badge variant="outline" className={`text-[10px] ${st.bg} ${st.color}`}>
                        {st.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span className="font-mono">{entry.transferCode}</span>
                      <span>•</span>
                      <span>{entry.method}</span>
                      <span>•</span>
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-success shrink-0">
                    +{formatVND(entry.amount)}
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
