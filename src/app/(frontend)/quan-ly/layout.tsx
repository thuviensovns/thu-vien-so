'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CreditCard, Users, ShoppingCart,
  Package, ChevronLeft, ShieldCheck, Settings,
  Wallet, Tag, ScrollText, RefreshCw, MessageCircle,
  Bell, Mail, Keyboard,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { usePolling } from '@/hooks/use-polling'
import { checkSystemHealth, updateSessionActivity, getCurrentSessionId, recordSession } from '@/lib/admin-security'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const adminNav = [
  { label: 'Tổng quan', href: '/quan-ly', icon: LayoutDashboard },
  { label: 'Tin nhắn hỗ trợ', href: '/quan-ly/tin-nhan', icon: Mail, notifiable: true },
  { label: 'Đơn hàng', href: '/quan-ly/don-hang', icon: ShoppingCart },
  { label: 'Sản phẩm', href: '/quan-ly/san-pham', icon: Package },
  { label: 'Người dùng', href: '/quan-ly/nguoi-dung', icon: Users },
  { label: 'Nạp tiền', href: '/quan-ly/nap-tien', icon: Wallet },
  { label: 'Mã giảm giá', href: '/quan-ly/khuyen-mai', icon: Tag },
  { label: 'Ngân hàng & QR', href: '/quan-ly/ngan-hang', icon: CreditCard },
  { label: 'Spin nội dung', href: '/quan-ly/noi-dung', icon: RefreshCw },
  { label: 'Chat hỗ trợ', href: '/quan-ly/chat-support', icon: MessageCircle },
  { label: 'Nhật ký', href: '/quan-ly/nhat-ky', icon: ScrollText },
  { label: 'Cài đặt', href: '/quan-ly/cai-dat', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [apiStatus, setApiStatus] = useState<'online' | 'degraded' | 'offline'>('online')

  // System health indicator
  const healthCheck = useCallback(async () => {
    const h = await checkSystemHealth()
    setApiStatus(h.apiStatus)
  }, [])
  usePolling(healthCheck, 60000, { enabled: user?.role === 'admin' })

  // Session tracking
  useEffect(() => {
    if (user?.role !== 'admin') return
    // Record session on mount if not already recorded
    if (!getCurrentSessionId()) {
      recordSession(user.email)
    }
    const sessionId = getCurrentSessionId()
    if (!sessionId) return
    const interval = setInterval(() => {
      updateSessionActivity(sessionId)
    }, 30000)
    return () => clearInterval(interval)
  }, [user?.role, user?.email])

  // Keyboard shortcuts: G+D/U/O/P/S/M/L
  useEffect(() => {
    if (user?.role !== 'admin') return
    let pending = ''
    let timer: ReturnType<typeof setTimeout>

    function handleKey(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return
      const key = e.key.toLowerCase()
      if (pending === 'g') {
        clearTimeout(timer)
        pending = ''
        const routes: Record<string, string> = {
          d: '/quan-ly',
          u: '/quan-ly/nguoi-dung',
          o: '/quan-ly/don-hang',
          p: '/quan-ly/san-pham',
          s: '/quan-ly/cai-dat',
          m: '/quan-ly/tin-nhan',
          l: '/quan-ly/nhat-ky',
        }
        if (routes[key]) {
          e.preventDefault()
          router.push(routes[key])
        }
      } else if (key === 'g') {
        pending = 'g'
        timer = setTimeout(() => { pending = '' }, 1000)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [user?.role, router])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount || 0)
      }
    } catch { /* ignore */ }
  }, [])

  usePolling(fetchNotifications, 15000, { enabled: user?.role === 'admin' })

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground mt-3">Đang tải...</p>
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">Truy cập bị từ chối</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Bạn cần đăng nhập với tài khoản Admin để truy cập trang này.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dang-nhap">Đăng nhập</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-warning" />
            Admin Panel
            <span
              className={`h-2 w-2 rounded-full inline-block ${
                apiStatus === 'online' ? 'bg-success' :
                apiStatus === 'degraded' ? 'bg-warning' : 'bg-destructive'
              }`}
              title={`API: ${apiStatus}`}
            />
          </h1>
          <p className="text-xs text-muted-foreground">Quản lý hệ thống Thư Viện Số</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Keyboard shortcuts help */}
          <Button
            variant="ghost"
            size="icon"
            title="Phím tắt: G+D Dashboard | G+U Users | G+O Orders | G+P Products | G+S Settings"
            onClick={() => alert('Phím tắt:\nG+D → Dashboard\nG+U → Người dùng\nG+O → Đơn hàng\nG+P → Sản phẩm\nG+S → Cài đặt\nG+M → Tin nhắn\nG+L → Nhật ký')}
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          {/* Notification bell */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => router.push('/quan-ly/tin-nhan')}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            {user.displayName || user.email}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar */}
        <nav className="space-y-1 lg:border-r lg:border-border lg:pr-4">
          <div className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            {adminNav.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const showBadge = item.notifiable && unreadCount > 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                  {showBadge && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 ml-auto">
                      {unreadCount}
                    </Badge>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
