'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Mail, Plus, Send, Trash2, Edit, Loader2, CheckCircle2, XCircle, Clock, Users as UsersIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Campaign {
  id: number
  name: string
  subject: string
  recipient_mode: 'all' | 'user_ids'
  status: 'draft' | 'sending' | 'completed' | 'failed'
  total_recipients: number
  sent_count: number
  failed_count: number
  created_by: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}
interface FullCampaign extends Campaign {
  html_content: string
  recipient_ids: string | null
}

const statusBadge = (s: Campaign['status']) => {
  const cfg = {
    draft: { label: 'Nháp', color: 'bg-muted/30 text-muted-foreground' },
    sending: { label: 'Đang gửi', color: 'bg-warning/10 text-warning' },
    completed: { label: 'Hoàn tất', color: 'bg-success/10 text-success' },
    failed: { label: 'Lỗi', color: 'bg-destructive/10 text-destructive' },
  }
  return cfg[s] || cfg.draft
}

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<FullCampaign | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/email-campaigns', { credentials: 'include' })
      if (res.ok) setCampaigns((await res.json()).docs || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function startNew() {
    setEditing({
      id: 0, name: '', subject: '', html_content: '',
      recipient_mode: 'all', recipient_ids: null,
      status: 'draft', total_recipients: 0, sent_count: 0, failed_count: 0,
      created_by: null, started_at: null, completed_at: null, created_at: '',
    })
    setEditOpen(true)
  }

  async function startEdit(id: number) {
    const res = await fetch(`/api/admin/email-campaigns/${id}`, { credentials: 'include' })
    if (!res.ok) { toast.error('Không tải được campaign'); return }
    setEditing(await res.json())
    setEditOpen(true)
  }

  async function handleSave() {
    if (!editing) return
    if (!editing.name || !editing.subject || !editing.html_content) {
      toast.error('Tên, tiêu đề, nội dung là bắt buộc')
      return
    }
    setSubmitting(true)
    try {
      const isNew = editing.id === 0
      const url = isNew ? '/api/admin/email-campaigns' : `/api/admin/email-campaigns/${editing.id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editing.name,
          subject: editing.subject,
          html_content: editing.html_content,
          recipient_mode: editing.recipient_mode,
          recipient_ids: editing.recipient_ids || null,
        }),
      })
      if (res.ok) {
        toast.success(isNew ? 'Đã tạo' : 'Đã lưu')
        setEditOpen(false)
        setEditing(null)
        fetchAll()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Lỗi')
      }
    } catch { toast.error('Lỗi mạng') }
    setSubmitting(false)
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Xóa campaign "${name}"?`)) return
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) { toast.success('Đã xóa'); fetchAll() }
    } catch { toast.error('Lỗi mạng') }
  }

  async function handleSend(id: number, name: string) {
    if (!confirm(`Gửi campaign "${name}" ngay?`)) return
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/send`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Đã đưa vào hàng đợi: ${data.queued} người nhận`)
        fetchAll()
      } else {
        toast.error(data.error || 'Lỗi')
      }
    } catch { toast.error('Lỗi mạng') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            Email Campaigns
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {campaigns.length} campaign · {campaigns.filter((c) => c.status === 'sending').length} đang gửi
          </p>
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Tạo campaign
        </Button>
      </div>

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-3 flex items-start gap-2 text-xs">
          <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-muted-foreground">
            Campaign sẽ được gửi bởi cron job <code className="bg-muted/50 px-1 rounded">send_email_queue</code> mỗi 5 phút.
            Cấu hình SMTP: <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>, <code>SMTP_FROM</code>.
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <Mail className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm">Chưa có campaign nào</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const badge = statusBadge(c.status)
            return (
              <Card key={c.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium">{c.name}</p>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${badge.color}`}>
                          {badge.label}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                          <UsersIcon className="h-2.5 w-2.5 mr-0.5 inline" />
                          {c.recipient_mode === 'all' ? 'Tất cả user' : 'Theo danh sách'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.subject}</p>
                      {c.status !== 'draft' && (
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <CheckCircle2 className="h-3 w-3 text-success" />
                            {c.sent_count}/{c.total_recipients}
                          </span>
                          {c.failed_count > 0 && (
                            <span className="flex items-center gap-0.5">
                              <XCircle className="h-3 w-3 text-destructive" />
                              {c.failed_count}
                            </span>
                          )}
                          <span>· {new Date(c.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {c.status === 'draft' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => startEdit(c.id)} className="h-7 px-2">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" onClick={() => handleSend(c.id, c.name)} className="h-7 px-2">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(c.id, c.name)}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id === 0 ? 'Tạo campaign mới' : `Chỉnh sửa: ${editing?.name}`}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs font-medium mb-1 block">Tên campaign</label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Tiêu đề email</label>
                <Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Người nhận</label>
                <div className="flex gap-2 mb-2">
                  {(['all', 'user_ids'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditing({ ...editing, recipient_mode: m })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        editing.recipient_mode === m
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-muted/30 border-border text-muted-foreground'
                      }`}
                    >
                      {m === 'all' ? 'Tất cả user' : 'Theo user ID'}
                    </button>
                  ))}
                </div>
                {editing.recipient_mode === 'user_ids' && (
                  <Input
                    value={editing.recipient_ids || ''}
                    onChange={(e) => setEditing({ ...editing, recipient_ids: e.target.value })}
                    placeholder="Ví dụ: 1,2,3,7"
                    className="font-mono"
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Nội dung HTML</label>
                <textarea
                  className="w-full min-h-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                  value={editing.html_content}
                  onChange={(e) => setEditing({ ...editing, html_content: e.target.value })}
                  placeholder="<h1>Xin chào!</h1><p>Nội dung email...</p>"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={submitting}>Hủy</Button>
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
