'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Ban, AlertTriangle, Trash2, Plus, Loader2, Search, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface BlockedIp {
  id: number
  ip: string
  reason: string | null
  attempts_count: number
  blocked_until: string | null
  is_permanent: boolean
  blocked_by: string | null
  created_at: string
}
interface FailedAttempt {
  id: number
  ip: string
  email: string | null
  type: string
  reason: string | null
  user_agent: string | null
  created_at: string
}

export default function SecurityPage() {
  const [tab, setTab] = useState<'attempts' | 'blocked'>('attempts')
  const [blocked, setBlocked] = useState<BlockedIp[]>([])
  const [attempts, setAttempts] = useState<FailedAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [searchIp, setSearchIp] = useState('')
  const [searchEmail, setSearchEmail] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newBlockIp, setNewBlockIp] = useState('')
  const [newBlockReason, setNewBlockReason] = useState('')
  const [newBlockHours, setNewBlockHours] = useState('24')
  const [newBlockPermanent, setNewBlockPermanent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [blockedRes, attemptsRes] = await Promise.all([
        fetch('/api/admin/blocked-ips', { credentials: 'include' }),
        fetch(
          `/api/admin/failed-attempts?${new URLSearchParams({
            ...(searchIp ? { ip: searchIp } : {}),
            ...(searchEmail ? { email: searchEmail } : {}),
          })}`,
          { credentials: 'include' },
        ),
      ])
      if (blockedRes.ok) setBlocked((await blockedRes.json()).docs || [])
      if (attemptsRes.ok) setAttempts((await attemptsRes.json()).docs || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [searchIp, searchEmail])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleBlock() {
    if (!newBlockIp.trim()) {
      toast.error('Nhập IP cần chặn')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/blocked-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ip: newBlockIp.trim(),
          reason: newBlockReason.trim() || 'Chặn thủ công',
          hours: Number(newBlockHours) || 24,
          is_permanent: newBlockPermanent,
        }),
      })
      if (res.ok) {
        toast.success('Đã chặn IP')
        setDialogOpen(false)
        setNewBlockIp('')
        setNewBlockReason('')
        setNewBlockHours('24')
        setNewBlockPermanent(false)
        fetchData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Không thể chặn IP')
      }
    } catch {
      toast.error('Lỗi mạng')
    }
    setSubmitting(false)
  }

  async function handleUnblock(ip: string) {
    if (!confirm(`Bỏ chặn IP ${ip}?`)) return
    try {
      const res = await fetch(`/api/admin/blocked-ips?ip=${encodeURIComponent(ip)}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (res.ok) {
        toast.success('Đã bỏ chặn')
        fetchData()
      } else toast.error('Không thể bỏ chặn')
    } catch { toast.error('Lỗi mạng') }
  }

  async function handleClearExpired() {
    try {
      const res = await fetch('/api/admin/blocked-ips?clear_expired=1', {
        method: 'DELETE', credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Đã xóa ${data.removed || 0} IP hết hạn`)
        fetchData()
      }
    } catch { toast.error('Lỗi mạng') }
  }

  async function handleClearAttempts(scope: 'all' | 'old') {
    const query = scope === 'old' ? '?older_than_hours=24' : ''
    if (!confirm(scope === 'old' ? 'Xóa các attempt cũ hơn 24 giờ?' : 'Xóa tất cả lịch sử đăng nhập thất bại?')) return
    try {
      const res = await fetch(`/api/admin/failed-attempts${query}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (res.ok) {
        toast.success('Đã dọn dẹp')
        fetchData()
      }
    } catch { toast.error('Lỗi mạng') }
  }

  const isActive = (b: BlockedIp) => b.is_permanent || (b.blocked_until && new Date(b.blocked_until) > new Date())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Bảo mật
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý IP bị chặn và theo dõi đăng nhập thất bại
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Chặn IP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chặn IP thủ công</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Địa chỉ IP *</label>
                <Input
                  value={newBlockIp}
                  onChange={(e) => setNewBlockIp(e.target.value)}
                  placeholder="1.2.3.4"
                  className="font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Lý do</label>
                <Input
                  value={newBlockReason}
                  onChange={(e) => setNewBlockReason(e.target.value)}
                  placeholder="Spam / Scraping / Lạm dụng..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="permanent"
                  type="checkbox"
                  checked={newBlockPermanent}
                  onChange={(e) => setNewBlockPermanent(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="permanent" className="text-sm cursor-pointer">
                  Chặn vĩnh viễn
                </label>
              </div>
              {!newBlockPermanent && (
                <div>
                  <label className="text-xs font-medium mb-1 block">Thời lượng (giờ)</label>
                  <Input
                    type="number"
                    min="1"
                    max="8760"
                    value={newBlockHours}
                    onChange={(e) => setNewBlockHours(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Hủy
              </Button>
              <Button onClick={handleBlock} disabled={submitting}>
                {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Chặn IP
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab('attempts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'attempts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle className="inline h-3.5 w-3.5 mr-1.5" />
          Đăng nhập thất bại ({attempts.length})
        </button>
        <button
          onClick={() => setTab('blocked')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'blocked' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Ban className="inline h-3.5 w-3.5 mr-1.5" />
          IP bị chặn ({blocked.filter(isActive).length})
        </button>
      </div>

      {tab === 'attempts' ? (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchIp}
                onChange={(e) => setSearchIp(e.target.value)}
                placeholder="Lọc IP..."
                className="pl-9 font-mono"
              />
            </div>
            <Input
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Lọc email..."
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={() => handleClearAttempts('old')}>
              Xóa {'>'}24h
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleClearAttempts('all')}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : attempts.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-success/50 mx-auto mb-3" />
              <p className="text-sm font-medium">Chưa có đăng nhập thất bại nào</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-1">
              {attempts.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/20 transition-colors border border-border/40">
                  <div className="h-7 w-7 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.email || '(không rõ email)'}</p>
                    <p className="text-xs text-muted-foreground truncate" title={a.user_agent || undefined}>
                      {a.reason || a.type}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                    {a.ip}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0 font-mono hidden sm:inline">
                    {new Date(a.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={handleClearExpired}>
              Xóa các chặn hết hạn
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : blocked.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-success/50 mx-auto mb-3" />
              <p className="text-sm font-medium">Không có IP nào bị chặn</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-1">
              {blocked.map((b) => {
                const active = isActive(b)
                return (
                  <div
                    key={b.id}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors ${
                      active ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/10 border-border/40 opacity-60'
                    }`}
                  >
                    <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${active ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                      <Ban className={`h-3.5 w-3.5 ${active ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-mono font-medium">{b.ip}</span>
                        {b.is_permanent && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-destructive/30 text-destructive">Vĩnh viễn</Badge>
                        )}
                        {b.blocked_by === 'auto' && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">Auto</Badge>
                        )}
                        {!active && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">Hết hạn</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.reason || 'Không có lý do'} · {b.attempts_count} lần thất bại
                      </p>
                    </div>
                    {!b.is_permanent && b.blocked_until && (
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono hidden sm:inline">
                        đến {new Date(b.blocked_until).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleUnblock(b.ip)} className="shrink-0 h-7 w-7 p-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
