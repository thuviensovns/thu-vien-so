'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Zap, Plus, Trash2, Edit, Loader2, Power, CheckCircle2, XCircle,
  AlertTriangle, PlayCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Automation {
  id: number
  name: string
  type: string
  config: Record<string, unknown>
  enabled: boolean
  last_run_at: string | null
  last_status: 'ok' | 'error' | null
  last_affected_count: number | null
  last_error: string | null
  run_count: number
}

const TYPE_OPTIONS: Array<{
  value: string
  label: string
  description: string
  defaultConfig: Record<string, unknown>
  fields: { key: string; label: string; type: 'number'; min?: number; max?: number }[]
}> = [
  {
    value: 'cancel_stale_orders',
    label: 'Huỷ đơn treo',
    description: 'Tự động huỷ các đơn pending sau N giờ',
    defaultConfig: { hours: 24 },
    fields: [{ key: 'hours', label: 'Sau N giờ', type: 'number', min: 1, max: 720 }],
  },
  {
    value: 'remind_unpaid_orders',
    label: 'Nhắc đơn chưa thanh toán',
    description: 'Gửi email nhắc cho user có đơn pending',
    defaultConfig: { hours: 2 },
    fields: [{ key: 'hours', label: 'Sau N giờ', type: 'number', min: 1, max: 168 }],
  },
  {
    value: 'purge_old_logs',
    label: 'Xoá activity logs cũ',
    description: 'Xoá activity_logs cũ hơn N ngày',
    defaultConfig: { days: 180 },
    fields: [{ key: 'days', label: 'Cũ hơn N ngày', type: 'number', min: 7, max: 3650 }],
  },
]

export default function AutomationsPage() {
  const [rules, setRules] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Automation> & { _isNew?: boolean }>({})
  const [submitting, setSubmitting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/automations', { credentials: 'include' })
      if (res.ok) setRules((await res.json()).docs || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function startNew() {
    const first = TYPE_OPTIONS[0]
    setEditing({
      _isNew: true, name: '', type: first.value,
      config: { ...first.defaultConfig }, enabled: true,
    })
    setOpen(true)
  }

  function startEdit(r: Automation) {
    setEditing({ ...r })
    setOpen(true)
  }

  async function handleSave() {
    if (!editing.name || !editing.type) {
      toast.error('Tên + loại là bắt buộc')
      return
    }
    setSubmitting(true)
    try {
      const isNew = editing._isNew
      const url = isNew ? '/api/admin/automations' : `/api/admin/automations/${editing.id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editing.name,
          type: editing.type,
          config: editing.config || {},
          enabled: editing.enabled !== false,
        }),
      })
      if (res.ok) {
        toast.success(isNew ? 'Đã tạo' : 'Đã lưu')
        setOpen(false)
        setEditing({})
        fetchAll()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Lỗi')
      }
    } catch { toast.error('Lỗi mạng') }
    setSubmitting(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Xóa automation này?')) return
    try {
      const res = await fetch(`/api/admin/automations/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) { toast.success('Đã xóa'); fetchAll() }
    } catch { toast.error('Lỗi mạng') }
  }

  async function handleToggle(r: Automation) {
    try {
      const res = await fetch(`/api/admin/automations/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !r.enabled }),
      })
      if (res.ok) fetchAll()
    } catch { toast.error('Lỗi mạng') }
  }

  async function handleRunNow() {
    try {
      const res = await fetch('/api/admin/cron/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: 'run_automations' }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(data.message || 'Đã chạy')
        fetchAll()
      } else {
        toast.error(data.message || data.error || 'Lỗi')
      }
    } catch { toast.error('Lỗi mạng') }
  }

  const currentTypeOpt = TYPE_OPTIONS.find((o) => o.value === editing.type)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            Automations
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rules.length} rule · {rules.filter((r) => r.enabled).length} đang bật
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRunNow}>
            <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
            Chạy ngay
          </Button>
          <Button size="sm" onClick={startNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tạo rule
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm">Chưa có automation nào</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => {
            const opt = TYPE_OPTIONS.find((o) => o.value === r.type)
            return (
              <Card key={r.id} className={r.enabled ? '' : 'opacity-60'}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                      r.last_status === 'error' ? 'bg-destructive/10' :
                      r.last_status === 'ok' ? 'bg-success/10' : 'bg-muted/50'
                    }`}>
                      {r.last_status === 'error' ? <XCircle className="h-4 w-4 text-destructive" /> :
                       r.last_status === 'ok' ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                       <Zap className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium">{r.name}</p>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                          {opt?.label || r.type}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {JSON.stringify(r.config)}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{r.run_count} lần chạy</span>
                        {r.last_affected_count !== null && <span>· {r.last_affected_count} ảnh hưởng</span>}
                        {r.last_run_at && <span>· {new Date(r.last_run_at).toLocaleString('vi-VN')}</span>}
                      </div>
                      {r.last_error && (
                        <div className="mt-1.5 text-[10px] bg-destructive/10 text-destructive p-1.5 rounded flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="break-all">{r.last_error}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => startEdit(r)} className="h-7 px-2">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={r.enabled ? 'default' : 'outline'}
                        onClick={() => handleToggle(r)}
                        className="h-7 px-2"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(r.id)}
                        className="h-7 px-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing._isNew ? 'Tạo automation' : `Chỉnh sửa: ${editing.name}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Tên rule</label>
              <Input
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ví dụ: Auto-cancel đơn sau 24h"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Loại</label>
              <select
                value={editing.type || ''}
                onChange={(e) => {
                  const opt = TYPE_OPTIONS.find((o) => o.value === e.target.value)
                  setEditing({ ...editing, type: e.target.value, config: { ...(opt?.defaultConfig || {}) } })
                }}
                disabled={!editing._isNew}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {currentTypeOpt && (
                <p className="text-[10px] text-muted-foreground mt-1">{currentTypeOpt.description}</p>
              )}
            </div>
            {currentTypeOpt?.fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium mb-1 block">{f.label}</label>
                <Input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={Number(editing.config?.[f.key] || 0)}
                  onChange={(e) => setEditing({
                    ...editing,
                    config: { ...(editing.config || {}), [f.key]: Number(e.target.value) },
                  })}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                id="enabled"
                type="checkbox"
                checked={editing.enabled !== false}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="enabled" className="text-sm cursor-pointer">Bật rule ngay</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Hủy</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
