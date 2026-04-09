'use client'

import { useMemo, useState, useEffect } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Package, Users, ShoppingCart, Wallet, TrendingUp, ArrowRight,
  CreditCard, Tag, BarChart3, Clock, CheckCircle2, XCircle, AlertCircle,
  CalendarDays, UserPlus, Activity, Shield, Download, Trash2, Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useBalance } from '@/hooks/use-balance'
import { usePolling } from '@/hooks/use-polling'
import { formatVND } from '@/lib/format'
import {
  getDemoOrders, getDemoUsers, getRevenueByDay,
  getActivityLog, getCoupons, getTopUpHistory, exportAllData,
} from '@/lib/admin-helpers'
import { fetchProducts } from '@/lib/payload-client'
import { SystemStatus } from '@/components/admin/SystemStatus'
import {
  checkSystemHealth, getLoginHistory, getFailedLoginsLast24h, getActiveSessions,
  type SystemHealth,
} from '@/lib/admin-security'

const typeIcons: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  order: { icon: ShoppingCart, color: 'text-warning' },
  user: { icon: Users, color: 'text-blue-500' },
  topup: { icon: Wallet, color: 'text-success' },
  coupon: { icon: Tag, color: 'text-purple-500' },
  product: { icon: Package, color: 'text-primary' },
  settings: { icon: CreditCard, color: 'text-muted-foreground' },
  system: { icon: AlertCircle, color: 'text-muted-foreground' },
}

const BUILT_IN_ADMIN_COUNT = 1

export default function AdminDashboard() {
  const { balance } = useBalance()
  const [refreshKey, setRefreshKey] = useState(0)
  const [dbStats, setDbStats] = useState<{ products: number; users: number; orders: number; revenue: number } | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)

  // Fetch real stats from DB on mount
  useEffect(() => {
    async function loadDbStats() {
      try {
        const [prodData, userData, orderData] = await Promise.all([
          fetchProducts({ limit: 1 }),
          fetch('/api/users?limit=0', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
          fetch('/api/orders?limit=0', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
        ])
        const productCount = prodData?.totalDocs ?? 0
        const userCount = userData?.totalDocs ?? 0
        const orderCount = orderData?.totalDocs ?? 0

        let revenue = 0
        try {
          // Use depth=0 for minimal payload; totalDocs gives count regardless of limit
          const paidRes = await fetch('/api/orders?where[status][equals]=paid&limit=100&depth=0', { credentials: 'include' })
          if (paidRes.ok) {
            const paidData = await paidRes.json()
            revenue = (paidData.docs || []).reduce((sum: number, o: { total?: number }) => sum + (o.total || 0), 0)
          }
        } catch {}

        if (productCount > 0 || userCount > 0) {
          setDbStats({ products: productCount, users: userCount, orders: orderCount, revenue })
        }
      } catch {}
    }
    loadDbStats()
  }, [refreshKey])

  // Check system health
  useEffect(() => {
    checkSystemHealth().then(setHealth)
  }, [refreshKey])

  // Refresh dashboard data periodically
  usePolling(() => setRefreshKey((k) => k + 1), 10000)

  const {
    stats, recentOrders, revenueData, recentActivity, activeCoupons, topUpTotal,
    todayOrders, todayRevenue, newUsersToday, topProducts, activeSessionCount,
    lastLogin, failedLoginCount,
  } = useMemo(() => {
    const users = getDemoUsers()
    const orders = getDemoOrders()
    const revenue = orders.filter((o) => o.status === 'paid').reduce((sum, o) => sum + (o.total || 0), 0)
    const coupons = getCoupons().filter((c) => c.active)
    const topups = getTopUpHistory()
    const topupSum = topups.filter((t) => t.status === 'completed').reduce((s, t) => s + t.amount, 0)

    // Today stats
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayOrd = orders.filter(o => o.createdAt.startsWith(todayStr))
    const todayRev = todayOrd.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0)
    const newUsers = users.filter(u => u.createdAt?.startsWith(todayStr)).length

    // Top products by revenue
    const productRevenue: Record<string, number> = {}
    orders.filter(o => o.status === 'paid').forEach(o => {
      o.items.forEach(item => {
        productRevenue[item.name] = (productRevenue[item.name] || 0) + item.price
      })
    })
    const topProds = Object.entries(productRevenue)
      .map(([name, rev]) => ({ name, revenue: rev }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Security
    const loginHist = getLoginHistory()
    const lastSuccessLogin = loginHist.find(l => l.success)
    const failedCount = getFailedLoginsLast24h()
    const activeSessionCnt = getActiveSessions().length

    return {
      stats: [
        { label: 'Sản phẩm', value: dbStats?.products ?? 0, icon: Package, color: 'text-primary', bg: 'bg-primary/10', href: '/quan-ly/san-pham' },
        { label: 'Người dùng', value: dbStats?.users ?? (users.length + BUILT_IN_ADMIN_COUNT), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', href: '/quan-ly/nguoi-dung' },
        { label: 'Đơn hàng', value: dbStats?.orders ?? orders.length, icon: ShoppingCart, color: 'text-warning', bg: 'bg-warning/10', href: '/quan-ly/don-hang' },
        { label: 'Doanh thu', value: formatVND(dbStats?.revenue ?? revenue), icon: TrendingUp, color: 'text-success', bg: 'bg-success/10', href: '/quan-ly/don-hang' },
      ],
      recentOrders: orders.slice(0, 5),
      revenueData: getRevenueByDay(),
      recentActivity: getActivityLog().slice(0, 8),
      activeCoupons: coupons.length,
      topUpTotal: topupSum,
      todayOrders: todayOrd.length,
      todayRevenue: todayRev,
      newUsersToday: newUsers,
      topProducts: topProds,
      activeSessionCount: activeSessionCnt,
      lastLogin: lastSuccessLogin,
      failedLoginCount: failedCount,
    }
  }, [refreshKey, dbStats])

  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1)

  function handleExportData() {
    const data = exportAllData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Tổng quan</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Thống kê hệ thống — cập nhật realtime</p>
      </div>

      {/* System Status Bar */}
      <SystemStatus health={health} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="border-border bg-card hover:border-border/80 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-8 w-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Today's stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-warning" />
              </div>
            </div>
            <p className="text-2xl font-bold">{todayOrders}</p>
            <p className="text-xs text-muted-foreground">Đơn hàng hôm nay</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatVND(todayRevenue)}</p>
            <p className="text-xs text-muted-foreground">Doanh thu hôm nay</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{newUsersToday}</p>
            <p className="text-xs text-muted-foreground">Người dùng mới hôm nay</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-purple-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{activeSessionCount}</p>
            <p className="text-xs text-muted-foreground">Phiên đang hoạt động</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Số dư Admin</p>
              <p className="text-lg font-bold text-success">{formatVND(balance)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <Tag className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mã giảm giá</p>
              <p className="text-lg font-bold text-purple-500">{activeCoupons} đang hoạt động</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tổng nạp tiền</p>
              <p className="text-lg font-bold text-blue-500">{formatVND(topUpTotal)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart + Recent orders + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-primary" />
              Doanh thu 7 ngày qua
            </h3>
            <div className="flex items-end gap-1.5 h-32">
              {revenueData.map((d) => {
                const pct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
                const dayLabel = new Date(d.date).toLocaleDateString('vi-VN', { weekday: 'short' })
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {d.revenue > 0 ? `${(d.revenue / 1000).toFixed(0)}k` : ''}
                    </span>
                    <div className="w-full flex justify-center">
                      <div
                        className={`w-full max-w-[32px] rounded-t transition-all ${
                          d.revenue > 0 ? 'bg-primary/80' : 'bg-muted/30'
                        }`}
                        style={{ height: `${Math.max(pct, 4)}%`, minHeight: '4px' }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{dayLabel}</span>
                  </div>
                )
              })}
            </div>
            {revenueData.every((d) => d.revenue === 0) && (
              <p className="text-center text-xs text-muted-foreground mt-2">Chưa có doanh thu</p>
            )}
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-warning" />
                Đơn hàng gần đây
              </h3>
              <Link href="/quan-ly/don-hang" className="text-xs text-primary hover:underline flex items-center gap-1">
                Xem tất cả <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Chưa có đơn hàng nào</p>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order) => {
                  const statusIcon = order.status === 'paid' ? CheckCircle2 : order.status === 'failed' ? XCircle : Clock
                  const statusColor = order.status === 'paid' ? 'text-success' : order.status === 'failed' ? 'text-destructive' : 'text-warning'
                  const StatusIcon = statusIcon
                  return (
                    <div key={order.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                      <StatusIcon className={`h-4 w-4 shrink-0 ${statusColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold truncate">{order.orderNumber}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{order.email}</p>
                      </div>
                      <span className="text-xs font-bold text-primary shrink-0">{formatVND(order.total)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
              <Package className="h-4 w-4 text-primary" />
              Sản phẩm bán chạy
            </h3>
            {topProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2.5">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-warning' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                      #{i + 1}
                    </span>
                    <span className="text-xs font-medium flex-1 truncate">{p.name}</span>
                    <span className="text-xs font-bold text-primary">{formatVND(p.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Security Summary */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-warning" />
            Bảo mật
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-muted-foreground">Đăng nhập gần nhất</p>
              <p className="font-medium mt-0.5">{lastLogin?.email || 'N/A'}</p>
              <p className="text-muted-foreground">
                {lastLogin ? new Date(lastLogin.timestamp).toLocaleString('vi-VN') : ''}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Đăng nhập thất bại (24h)</p>
              <p className={`text-lg font-bold mt-0.5 ${failedLoginCount > 0 ? 'text-destructive' : 'text-success'}`}>
                {failedLoginCount}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Phiên đang hoạt động</p>
              <p className="text-lg font-bold text-success mt-0.5">{activeSessionCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity log */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Hoạt động gần đây
            </h3>
            <Link href="/quan-ly/nhat-ky" className="text-xs text-primary hover:underline flex items-center gap-1">
              Xem tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Chưa có hoạt động nào được ghi lại</p>
          ) : (
            <div className="space-y-1.5">
              {recentActivity.map((entry) => {
                const cfg = typeIcons[entry.type] || typeIcons.system
                const Icon = cfg.icon
                return (
                  <div key={entry.id} className="flex items-center gap-2.5 p-1.5 rounded text-xs">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                    <span className="font-medium">{entry.action}</span>
                    {entry.adminEmail && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal">
                        {entry.adminEmail}
                      </Badge>
                    )}
                    <span className="text-muted-foreground truncate flex-1">{entry.detail}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links + Quick actions */}
      <div>
        <h3 className="text-sm font-bold mb-3">Truy cập nhanh</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: 'Ngân hàng & QR', desc: 'Cấu hình STK', href: '/quan-ly/ngan-hang', icon: CreditCard },
            { label: 'Mã giảm giá', desc: 'Tạo & quản lý', href: '/quan-ly/khuyen-mai', icon: Tag },
            { label: 'Nạp tiền', desc: 'Quản lý nạp tiền', href: '/quan-ly/nap-tien', icon: Wallet },
            { label: 'Cài đặt', desc: 'Cấu hình hệ thống', href: '/quan-ly/cai-dat', icon: AlertCircle },
          ].map((link) => {
            const Icon = link.icon
            return (
              <Link key={link.href + link.label} href={link.href}>
                <Card className="border-border bg-card hover:border-primary/30 transition-colors cursor-pointer h-full">
                  <CardContent className="p-3 flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{link.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{link.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* One-click actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="h-auto p-3 flex flex-col items-center gap-1.5"
            onClick={() => {
              checkSystemHealth().then((h) => {
                setHealth(h)
                alert(`API: ${h.apiStatus} | Ping: ${h.responseTimeMs}ms | Storage: ${h.storageUsed}`)
              })
            }}
          >
            <Activity className="h-4 w-4 text-success" />
            <span className="text-xs">Kiểm tra hệ thống</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-3 flex flex-col items-center gap-1.5"
            onClick={handleExportData}
          >
            <Download className="h-4 w-4 text-blue-500" />
            <span className="text-xs">Xuất dữ liệu</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-3 flex flex-col items-center gap-1.5"
            onClick={async () => {
              const confirmed = await confirmDialog({
                title: 'Xóa cache',
                description: 'Xóa tất cả cache dữ liệu? Trang sẽ tải lại dữ liệu mới.',
                confirmText: 'Xóa cache',
              })
              if (!confirmed) return
              ;['product_cache', 'category_cache'].forEach(k => localStorage.removeItem(k))
              toast.success('Đã xóa cache')
            }}
          >
            <Trash2 className="h-4 w-4 text-warning" />
            <span className="text-xs">Xóa cache</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-3 flex flex-col items-center gap-1.5"
            onClick={() => window.location.reload()}
          >
            <Zap className="h-4 w-4 text-purple-500" />
            <span className="text-xs">Làm mới</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
