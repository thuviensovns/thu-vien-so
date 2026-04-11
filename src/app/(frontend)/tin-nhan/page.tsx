'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { usePolling } from '@/hooks/use-polling'
import { Button } from '@/components/ui/button'
import {
  Mail, MessageCircle, Clock, CheckCircle2, AlertCircle,
  ChevronLeft, Inbox, Send, ArrowLeft, RefreshCw, Loader2,
} from 'lucide-react'

interface Message {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: 'new' | 'processing' | 'replied' | 'closed'
  adminNote?: string
  createdAt: string
  updatedAt: string
}

const statusConfig = {
  new: { label: 'Đã gửi', icon: Send, color: 'text-blue-500 bg-blue-500/10' },
  processing: { label: 'Đang xử lý', icon: Clock, color: 'text-warning bg-warning/10' },
  replied: { label: 'Đã phản hồi', icon: MessageCircle, color: 'text-success bg-success/10' },
  closed: { label: 'Đã đóng', icon: CheckCircle2, color: 'text-muted-foreground bg-muted' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ngày trước`
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

export default function CustomerInboxPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Message | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchMessages = useCallback(async (showRefresh?: boolean) => {
    if (!user?.email) {
      setLoading(false)
      return
    }
    if (showRefresh) setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/my-messages', { credentials: 'include', cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        // Mark inbox as seen so the UserMenu badge clears
        try {
          localStorage.setItem(`tvs:inbox-seen:${user.email.toLowerCase()}`, new Date().toISOString())
          window.dispatchEvent(new Event('inbox:refresh'))
        } catch { /* ignore */ }
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Không thể tải tin nhắn')
      }
    } catch {
      setError('Không thể kết nối đến máy chủ')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.email])

  // Initial fetch when user is ready
  useEffect(() => {
    if (!authLoading) {
      fetchMessages()
    }
  }, [authLoading, fetchMessages])

  // Auto-refresh every 30s
  usePolling(fetchMessages, 30000, { enabled: !!user?.email && !authLoading })

  // Auth loading
  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground mt-3">Đang tải...</p>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Mail className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold">Đăng nhập để xem tin nhắn</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Bạn cần đăng nhập để xem phản hồi từ đội ngũ hỗ trợ.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dang-nhap">Đăng nhập</Link>
        </Button>
      </div>
    )
  }

  // Detail view
  if (selected) {
    const sc = statusConfig[selected.status]
    const StatusIcon = sc.icon
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </button>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{selected.subject || 'Không có tiêu đề'}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gửi lúc {new Date(selected.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                <StatusIcon className="h-3 w-3" />
                {sc.label}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Customer's original message */}
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Send className="h-3 w-3" />
                Tin nhắn của bạn
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{selected.message}</p>
            </div>

            {/* Admin reply */}
            {selected.adminNote ? (
              <div className="rounded-lg bg-success/5 border border-success/20 p-4">
                <p className="text-xs font-medium text-success dark:text-success mb-2 flex items-center gap-1.5">
                  <MessageCircle className="h-3 w-3" />
                  Phản hồi từ đội ngũ hỗ trợ
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{selected.adminNote}</p>
                {selected.updatedAt && (
                  <p className="text-[10px] text-muted-foreground mt-3">
                    Phản hồi lúc {new Date(selected.updatedAt).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-muted/30 border border-dashed border-border p-6 text-center">
                <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">
                  {selected.status === 'new'
                    ? 'Tin nhắn đang chờ xử lý'
                    : selected.status === 'processing'
                    ? 'Đội ngũ hỗ trợ đang xử lý'
                    : 'Chưa có phản hồi'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Chúng tôi sẽ phản hồi sớm nhất có thể. Vui lòng kiểm tra lại sau.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" asChild>
            <Link href="/lien-he">
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Gửi tin nhắn mới
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // List view
  const repliedMessages = messages.filter((m) => m.status === 'replied' && m.adminNote)

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Hộp thư của bạn
          </h1>
          <p className="text-xs text-muted-foreground">
            {user.email} — Theo dõi phản hồi từ đội ngũ hỗ trợ
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 h-8 w-8"
          disabled={refreshing}
          onClick={() => fetchMessages(true)}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => fetchMessages(true)}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Đang tải tin nhắn...</p>
        </div>
      ) : messages.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">Chưa có tin nhắn nào</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Khi bạn gửi liên hệ qua trang Liên hệ, tin nhắn và phản hồi sẽ hiển thị ở đây.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Lưu ý: Hãy sử dụng email <strong>{user.email}</strong> khi gửi liên hệ để nhận phản hồi tại đây.
          </p>
          <Button asChild className="mt-4">
            <Link href="/lien-he">
              <Send className="h-4 w-4 mr-1.5" />
              Gửi tin nhắn
            </Link>
          </Button>
        </div>
      ) : (
        /* Message list */
        <div className="space-y-2">
          {repliedMessages.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-success/5 border border-success/20 text-sm text-success dark:text-success mb-3">
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span>Bạn có <strong>{repliedMessages.length}</strong> phản hồi từ đội ngũ hỗ trợ!</span>
            </div>
          )}

          {messages.map((msg) => {
            const sc = statusConfig[msg.status]
            const StatusIcon = sc.icon
            const hasReply = !!msg.adminNote
            return (
              <button
                key={msg.id}
                onClick={() => setSelected(msg)}
                className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-sm ${
                  msg.status === 'replied' && hasReply
                    ? 'border-success/30 bg-success/5 hover:border-success/50'
                    : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${sc.color}`}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold truncate">
                        {msg.subject || 'Không có tiêu đề'}
                      </h3>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {timeAgo(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {msg.message}
                    </p>
                    {hasReply && (
                      <p className="text-xs text-success dark:text-success mt-1.5 flex items-center gap-1 font-medium">
                        <MessageCircle className="h-3 w-3" />
                        Đã có phản hồi — nhấn để xem
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}

          <div className="text-center pt-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/lien-he">
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Gửi tin nhắn mới
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
