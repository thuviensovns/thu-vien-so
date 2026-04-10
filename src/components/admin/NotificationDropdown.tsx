'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Wallet, Mail, CheckCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatVND } from '@/lib/format'

interface TopUpNotification {
  id: number
  type: 'topup'
  status: string
  userName: string | null
  userEmail: string | null
  amount: number
  transferCode: string
  confirmedAt: string | null
  createdAt: string | null
}

interface NotificationData {
  unreadCount: number
  unreadMessages: number
  unreadTopUps: number
  recentTopUps: TopUpNotification[]
}

interface Props {
  data: NotificationData
  onMarkedRead?: () => void
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}

export default function NotificationDropdown({ data, onMarkedRead }: Props) {
  const [open, setOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markAllRead() {
    setMarking(true)
    try {
      await fetch('/api/notifications/topups/read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      onMarkedRead?.()
    } catch { /* ignore */ }
    setMarking(false)
  }

  async function markOneRead(id: number) {
    try {
      await fetch('/api/notifications/topups/read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      onMarkedRead?.()
    } catch { /* ignore */ }
  }

  const { unreadCount, unreadMessages, unreadTopUps, recentTopUps } = data
  const hasNotifications = unreadTopUps > 0 || unreadMessages > 0

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-bold">Thông báo</h3>
            {unreadTopUps > 0 && (
              <button
                onClick={markAllRead}
                disabled={marking}
                className="text-[11px] text-primary hover:underline disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCheck className="h-3 w-3" />
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {!hasNotifications ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Không có thông báo mới
              </div>
            ) : (
              <>
                {/* Topup notifications */}
                {recentTopUps.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20">
                      Nạp tiền ({unreadTopUps})
                    </div>
                    {recentTopUps.map((t) => {
                      const isPending = t.status === 'pending'
                      return (
                        <div
                          key={t.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/50 last:border-0"
                          onClick={() => {
                            router.push('/quan-ly/nap-tien')
                            setOpen(false)
                          }}
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isPending ? 'bg-warning/10' : 'bg-success/10'}`}>
                            <Wallet className={`h-4 w-4 ${isPending ? 'text-warning' : 'text-success'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug">
                              <span className="text-foreground">{t.userName || t.userEmail || 'Khách'}</span>
                              {isPending ? ' yêu cầu nạp ' : ' đã nạp '}
                              <span className={`font-bold ${isPending ? 'text-warning' : 'text-success'}`}>{formatVND(t.amount)}</span>
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-block text-[9px] px-1.5 py-0 rounded-full font-medium ${isPending ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                                {isPending ? 'Đang chờ' : 'Thành công'}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {t.transferCode} · {timeAgo(isPending ? t.createdAt : t.confirmedAt)}
                              </span>
                            </div>
                          </div>
                          {!isPending && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                markOneRead(t.id)
                              }}
                              className="text-muted-foreground hover:text-foreground shrink-0 mt-1"
                              title="Đánh dấu đã đọc"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Messages notification */}
                {unreadMessages > 0 && (
                  <div>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20">
                      Tin nhắn ({unreadMessages})
                    </div>
                    <div
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {
                        router.push('/quan-ly/tin-nhan')
                        setOpen(false)
                      }}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {unreadMessages} tin nhắn hỗ trợ mới
                        </p>
                        <p className="text-[11px] text-muted-foreground">Nhấn để xem chi tiết</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
