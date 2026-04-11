'use client'

import { useState, useEffect, useCallback } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import Link from 'next/link'
import {
  User, Package, Download, Settings, LogIn, LogOut, Loader2,
  Wallet, ShieldCheck, Save, Check,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { useBalance } from '@/hooks/use-balance'
import { useRouter } from 'next/navigation'
import { formatVND } from '@/lib/format'
import { toast } from 'sonner'
import OrdersTab, { type Order } from './OrdersTab'
import DownloadsTab, { type DownloadRecord } from './DownloadsTab'

const tabs = [
  { id: 'profile', label: 'Thông tin', icon: User },
  { id: 'orders', label: 'Đơn hàng', icon: Package },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
] as const

function getDemoOrders(): Order[] {
  try {
    const raw = localStorage.getItem('demo_orders')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export default function AccountPage() {
  const { user, isLoading, logout } = useAuth()
  const { balance } = useBalance()
  const router = useRouter()
  // Read ?tab=<id> from URL synchronously so fetchOrders/fetchDownloads can start
  // on the first render (parallel with auth) instead of waiting an extra cycle.
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'profile'
    const tab = new URLSearchParams(window.location.search).get('tab')
    return tab && ['profile', 'orders', 'downloads', 'settings'].includes(tab) ? tab : 'profile'
  })
  const [orders, setOrders] = useState<Order[]>([])
  const [downloads, setDownloads] = useState<DownloadRecord[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingDownloads, setLoadingDownloads] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState('')
  const [nameSaved, setNameSaved] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    if (user?.displayName) setNewDisplayName(user.displayName)
  }, [user?.displayName])

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const res = await fetch('/api/orders?depth=1&sort=-createdAt&limit=20', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.docs?.length > 0) { setOrders(data.docs); setLoadingOrders(false); return }
      }
    } catch {}
    setOrders(getDemoOrders())
    setLoadingOrders(false)
  }, [])

  const fetchDownloads = useCallback(async () => {
    setLoadingDownloads(true)
    try {
      const res = await fetch('/api/downloads?depth=1&sort=-createdAt&limit=20', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setDownloads(data.docs || [])
        setLoadingDownloads(false)
        return
      }
      // 401/403 means no valid session — user is in demo mode, show empty state
      if (res.status === 401 || res.status === 403) {
        setDownloads([])
        setLoadingDownloads(false)
        return
      }
    } catch {}
    setDownloads([])
    setLoadingDownloads(false)
  }, [])

  // Fire data fetches in parallel with auth resolution — the cookie is already
  // present on the request, so /api/orders and /api/downloads work before
  // useAuth finishes. Avoids a serial wait (auth → then fetch) on navigation
  // from payment success.
  useEffect(() => {
    if (activeTab === 'orders') fetchOrders()
  }, [activeTab, fetchOrders])

  useEffect(() => {
    if (activeTab === 'downloads') fetchDownloads()
  }, [activeTab, fetchDownloads])

  function handleUpdateName() {
    if (!newDisplayName.trim()) return
    try {
      const raw = localStorage.getItem('demo_session')
      if (raw) {
        const session = JSON.parse(raw)
        session.displayName = newDisplayName.trim()
        localStorage.setItem('demo_session', JSON.stringify(session))
      }
      const usersRaw = localStorage.getItem('demo_users')
      if (usersRaw) {
        const users = JSON.parse(usersRaw)
        const updated = users.map((u: { id: string; displayName?: string }) =>
          u.id === user?.id ? { ...u, displayName: newDisplayName.trim() } : u
        )
        localStorage.setItem('demo_users', JSON.stringify(updated))
      }
    } catch {}
    setNameSaved(true)
    toast.success('Đã cập nhật tên hiển thị!')
    setTimeout(() => setNameSaved(false), 2000)
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword) {
      toast.error('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có tối thiểu 8 ký tự.')
      return
    }
    setChangingPassword(true)
    try {
      // Verify current password by attempting login
      const loginRes = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: user?.email, password: currentPassword }),
      })
      if (!loginRes.ok) {
        toast.error('Mật khẩu hiện tại không đúng.')
        setChangingPassword(false)
        return
      }
      // Update password
      const updateRes = await fetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: newPassword }),
      })
      if (updateRes.ok) {
        toast.success('Đổi mật khẩu thành công!')
        setCurrentPassword('')
        setNewPassword('')
      } else {
        toast.error('Không thể đổi mật khẩu. Vui lòng thử lại.')
      }
    } catch {
      toast.error('Lỗi kết nối. Vui lòng thử lại.')
    }
    setChangingPassword(false)
  }

  async function handleDeleteAccount() {
    const confirmed = await confirmDialog({
      title: 'Xóa tài khoản',
      description: 'Bạn có chắc chắn muốn xóa tài khoản? Hành động này KHÔNG THỂ hoàn tác.',
      confirmText: 'Xóa tài khoản',
      variant: 'destructive',
    })
    if (!confirmed) return
    setDeletingAccount(true)
    try {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        toast.success('Tài khoản đã được xóa.')
        await logout()
        router.push('/')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Không thể xóa tài khoản. Vui lòng liên hệ hỗ trợ.')
      }
    } catch {
      toast.error('Lỗi kết nối. Vui lòng thử lại.')
    }
    setDeletingAccount(false)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 sm:py-20 text-center">
        <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <User className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold">Chưa đăng nhập</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
          Đăng nhập để xem thông tin tài khoản, lịch sử mua hàng và quản lý downloads.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/dang-nhap"><LogIn className="mr-2 h-4 w-4" />Đăng nhập</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dang-ky">Đăng ký tài khoản</Link>
          </Button>
        </div>
      </div>
    )
  }

  const isAdmin = user.role === 'admin'

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-5 sm:mb-6">Tài khoản</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
        {/* Sidebar */}
        <Card className="border-border bg-card h-fit md:col-span-1">
          <CardContent className="p-2 sm:p-3">
            <Link
              href="/nap-tien"
              className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/10 hover:bg-success/10 transition-colors mb-2"
            >
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-success" />Số dư
              </span>
              <span className="text-sm font-bold text-success">{formatVND(balance)}</span>
            </Link>

            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible scrollbar-hide">
              {tabs.map((tab) => (
                <Button
                  key={tab.id} variant="ghost"
                  onClick={() => setActiveTab(tab.id)}
                  className={`justify-start gap-2 shrink-0 text-sm ${activeTab === tab.id ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </Button>
              ))}
              {isAdmin && (
                <>
                  <Separator className="hidden md:block my-1" />
                  <Button variant="ghost" onClick={() => router.push('/quan-ly')} className="justify-start gap-2 text-warning shrink-0 text-sm">
                    <ShieldCheck className="h-4 w-4" /><span>Admin Panel</span>
                  </Button>
                </>
              )}
              <Separator className="hidden md:block my-1" />
              <Button variant="ghost" onClick={async () => { await logout(); router.push('/') }} className="justify-start gap-2 text-muted-foreground hover:text-destructive shrink-0 text-sm">
                <LogOut className="h-4 w-4" /><span>Đăng xuất</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="md:col-span-3">
          <Card className="border-border bg-card">
            <CardContent className="p-4 sm:p-6">
              {activeTab === 'profile' && (
                <div>
                  <h2 className="font-bold mb-4">Thông tin cá nhân</h2>
                  <div className="space-y-3 text-sm">
                    {[
                      { label: 'Tên', value: user.displayName || '—' },
                      { label: 'Email', value: user.email },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <span className="text-muted-foreground w-24 shrink-0">{row.label}:</span>
                        <span className="font-medium">{row.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground w-24 shrink-0">Vai trò:</span>
                      <Badge variant="outline" className={`text-xs capitalize ${isAdmin ? 'text-warning border-warning/30' : ''}`}>
                        {isAdmin ? 'Admin' : 'Customer'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground w-24 shrink-0">Số dư:</span>
                      <span className="font-bold text-success">{formatVND(balance)}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <OrdersTab orders={orders} loading={loadingOrders} onRefresh={fetchOrders} />
              )}

              {activeTab === 'downloads' && (
                <DownloadsTab downloads={downloads} loading={loadingDownloads} onRefresh={fetchDownloads} onDownloadsChange={setDownloads} />
              )}

              {activeTab === 'settings' && (
                <div>
                  <h2 className="font-bold mb-4">Cài đặt tài khoản</h2>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium mb-2">Tên hiển thị</h3>
                      <div className="flex gap-2">
                        <input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Nhập tên hiển thị mới" className="flex-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary" />
                        <Button size="sm" variant="outline" className="shrink-0" onClick={handleUpdateName}>
                          {nameSaved ? <Check className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                          {nameSaved ? 'Đã lưu' : 'Cập nhật'}
                        </Button>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium mb-2">Đổi mật khẩu</h3>
                      <div className="space-y-2 max-w-sm">
                        <input type="password" placeholder="Mật khẩu hiện tại" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary" />
                        <input type="password" placeholder="Mật khẩu mới (tối thiểu 8 ký tự)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary" />
                        <Button size="sm" variant="outline" disabled={changingPassword} onClick={handleChangePassword}>
                          {changingPassword ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                          Đổi mật khẩu
                        </Button>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium mb-2">Thông báo</h3>
                      <div className="space-y-2">
                        {['Nhận email khi có sản phẩm mới', 'Nhận email về khuyến mãi', 'Nhận email xác nhận đơn hàng'].map((text) => (
                          <label key={text} className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                            <input type="checkbox" defaultChecked className="accent-cyan-500 rounded" />{text}
                          </label>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium text-destructive mb-2">Vùng nguy hiểm</h3>
                      <p className="text-xs text-muted-foreground mb-2">Xóa tài khoản sẽ xóa tất cả dữ liệu và không thể khôi phục.</p>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" disabled={deletingAccount} onClick={handleDeleteAccount}>
                        {deletingAccount ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                        Xóa tài khoản
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
