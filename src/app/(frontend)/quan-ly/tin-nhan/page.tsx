'use client'

import { useState, useCallback } from 'react'
import {
  Mail, MailOpen, Clock, CheckCircle2, XCircle, Search,
  Trash2, MessageSquare, Send, Loader2, RefreshCw, ArrowLeft,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { usePolling } from '@/hooks/use-polling'
import { useTick } from '@/hooks/use-tick'
import { timeAgoVN, formatVNDateTime } from '@/lib/format'

interface Message {
  id: number
  name: string
  email: string
  subject: string
  message: string
  status: 'new' | 'processing' | 'replied' | 'closed'
  adminNote?: string
  ipAddress?: string
  createdAt: string
  updatedAt: string
}

const statusConfig = {
  new: { label: 'Mới', icon: Mail, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  processing: { label: 'Đang xử lý', icon: Clock, color: 'bg-warning/10 text-warning border-warning/20' },
  replied: { label: 'Đã phản hồi', icon: CheckCircle2, color: 'bg-success/10 text-success border-success/20' },
  closed: { label: 'Đã đóng', icon: XCircle, color: 'bg-muted text-muted-foreground border-border' },
}

export default function MessengerPage() {
  useTick()
  const [messages, setMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<Message | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.recent || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  usePolling(fetchMessages, 15000)

  const updateStatus = async (id: number, status: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated = await res.json()
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)))
        if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status: status as Message['status'] } : null)
        toast.success(`Đã cập nhật trạng thái: ${statusConfig[status as keyof typeof statusConfig]?.label}`)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error || `Lỗi cập nhật (HTTP ${res.status})`)
      }
    } catch (e) {
      toast.error('Lỗi kết nối: ' + ((e as Error)?.message || 'unknown'))
    }
    setSaving(false)
  }

  const saveNote = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/messages/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ adminNote, status: 'replied' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setMessages((prev) => prev.map((m) => (m.id === selected.id ? { ...m, ...updated } : m)))
        setSelected((prev) => prev ? { ...prev, adminNote: updated.adminNote ?? adminNote, status: 'replied' } : null)
        toast.success('Đã lưu phản hồi', {
          description: `Khách hàng ${selected.email} sẽ thấy phản hồi trong trang Hộp thư.`,
        })
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('[saveNote] PATCH failed:', res.status, err)
        toast.error(err?.error || `Lỗi lưu phản hồi (HTTP ${res.status})`)
      }
    } catch (e) {
      console.error('[saveNote] exception:', e)
      toast.error('Lỗi kết nối: ' + ((e as Error)?.message || 'unknown'))
    }
    setSaving(false)
  }

  const deleteMessage = async (id: number) => {
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== id))
        if (selected?.id === id) setSelected(null)
        toast.success('Đã xóa tin nhắn')
      }
    } catch { toast.error('Lỗi xóa') }
  }

  const filtered = messages.filter((m) => {
    if (filter !== 'all' && m.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q)
    }
    return true
  })

  const newCount = messages.filter((m) => m.status === 'new').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Tin nhắn hỗ trợ
            {newCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {newCount} mới
              </Badge>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý tin nhắn liên hệ từ khách hàng
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMessages}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Làm mới
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, email, tiêu đề..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'new', label: 'Mới' },
            { key: 'processing', label: 'Đang xử lý' },
            { key: 'replied', label: 'Đã phản hồi' },
            { key: 'closed', label: 'Đã đóng' },
          ].map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-9"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
        {/* Message list */}
        <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
          {filtered.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <MailOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Không có tin nhắn nào</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((msg) => {
              const sc = statusConfig[msg.status]
              const Icon = sc.icon
              const isSelected = selected?.id === msg.id
              return (
                <Card
                  key={msg.id}
                  className={`border cursor-pointer transition-all hover:border-primary/30 ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-border'
                  } ${msg.status === 'new' ? 'bg-blue-500/[0.02]' : ''}`}
                  onClick={() => {
                    setSelected(msg)
                    setAdminNote(msg.adminNote || '')
                    if (msg.status === 'new') updateStatus(msg.id, 'processing')
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2.5">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.status === 'new' ? 'bg-blue-500/10' : 'bg-muted'
                      }`}>
                        <Icon className={`h-4 w-4 ${msg.status === 'new' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-medium truncate ${msg.status === 'new' ? 'font-bold' : ''}`}>
                            {msg.name}
                          </span>
                          <span
                            className="text-[10px] text-muted-foreground whitespace-nowrap"
                            title={formatVNDateTime(msg.createdAt)}
                          >
                            {timeAgoVN(msg.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{msg.email}</p>
                        <p className={`text-xs mt-1 truncate ${msg.status === 'new' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                          {msg.subject}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 ${sc.color}`}>
                        {sc.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selected ? (
            <Card className="border-border sticky top-4">
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-base truncate">{selected.subject}</h3>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${statusConfig[selected.status].color}`}>
                        {statusConfig[selected.status].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">{selected.name}</span>
                      <span>{selected.email}</span>
                      <span title={formatVNDateTime(selected.createdAt)}>
                        {timeAgoVN(selected.createdAt)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Gửi lúc {formatVNDateTime(selected.createdAt)}
                      {selected.status === 'replied' && selected.adminNote && selected.updatedAt && (
                        <>
                          <span className="mx-1.5">·</span>
                          Phản hồi lúc {formatVNDateTime(selected.updatedAt)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMessage(selected.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 lg:hidden"
                      onClick={() => setSelected(null)}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Message body */}
                <div className="bg-muted/50 rounded-lg p-4 mb-4 border border-border">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{selected.message}</p>
                </div>

                {/* Status actions */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(['new', 'processing', 'replied', 'closed'] as const).map((s) => (
                    <Button
                      key={s}
                      variant={selected.status === s ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7"
                      disabled={saving}
                      onClick={() => updateStatus(selected.id, s)}
                    >
                      {statusConfig[s].label}
                    </Button>
                  ))}
                </div>

                {/* Admin reply */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Ghi chú / Phản hồi</label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Viết phản hồi cho tin nhắn này..."
                    rows={4}
                    className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none resize-none"
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={saving || !adminNote.trim()}
                    onClick={saveNote}
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Lưu phản hồi
                  </Button>
                </div>

                {/* IP info */}
                {selected.ipAddress && (
                  <p className="text-[10px] text-muted-foreground mt-3">
                    IP: {selected.ipAddress}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Chọn tin nhắn để xem chi tiết</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
