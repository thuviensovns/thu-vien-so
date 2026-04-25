'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ShoppingCart, Package, Calendar, CreditCard, Search,
  CheckCircle2, Clock, XCircle, AlertCircle, Filter,
  ArrowUpDown, FileDown, Loader2, ScanSearch, User, Wallet,
  Mail, Phone, Hash, X, TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatVND, formatDate, formatVNDateTime } from '@/lib/format'
import { toast } from 'sonner'
import AdminPagination, { paginate } from '@/components/admin/AdminPagination'

const ITEMS_PER_PAGE = 10

interface OrderItem {
  name: string
  price: number
}

interface Order {
  id: number
  orderNumber: string
  email: string
  total: number
  status: 'paid' | 'pending' | 'failed' | 'refunded'
  method: string
  items: OrderItem[]
  createdAt: string
}

interface LookupResult {
  order: {
    id: number
    orderNumber: string
    total: number
    status: string
    method: string | null
    transactionId: string | null
    paidAt: string | null
    customerEmail: string | null
    customerPhone: string | null
    note: string | null
    items: { productId: number | string | null; name: string; price: number }[]
    createdAt: string
    updatedAt: string
  }
  customer: {
    id: number
    email: string | null
    displayName: string | null
    phone: string | null
    role: string
    balance: number
    createdAt: string | null
    stats: {
      totalOrders: number
      paidOrders: number
      pendingOrders: number
      totalSpent: number
      lastOrderAt: string | null
    }
  } | null
}

const statusConfig = {
  paid: { label: 'Đã thanh toán', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10 border-success/20' },
  pending: { label: 'Chờ xử lý', icon: Clock, color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  failed: { label: 'Thất bại', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
  refunded: { label: 'Hoàn tiền', icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted/10 border-muted/20' },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(1)

  const [lookupCode, setLookupCode] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  async function runLookup(codeOverride?: string) {
    const code = (codeOverride ?? lookupCode).trim()
    if (!code) {
      toast.error('Vui lòng nhập mã đơn hàng')
      return
    }
    setLookupLoading(true)
    setLookupError(null)
    setLookupResult(null)
    try {
      const res = await fetch(`/api/admin/orders/lookup/${encodeURIComponent(code)}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setLookupResult(data)
      } else {
        const err = await res.json().catch(() => ({}))
        const msg = err?.error || `Không tìm thấy (HTTP ${res.status})`
        setLookupError(msg)
        toast.error(msg)
      }
    } catch (e) {
      const msg = 'Lỗi kết nối: ' + ((e as Error)?.message || 'unknown')
      setLookupError(msg)
      toast.error(msg)
    }
    setLookupLoading(false)
  }

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders?limit=500', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setOrders(data.docs || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filtered = useMemo(() => {
    let result = [...orders]
    if (filterStatus !== 'all') {
      result = result.filter((o) => o.status === filterStatus)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q)
      )
    }
    result.sort((a, b) => {
      const cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortDesc ? -cmp : cmp
    })
    return result
  }, [orders, search, filterStatus, sortDesc])

  const revenue = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.total, 0)
  const paidCount = orders.filter((o) => o.status === 'paid').length
  const pendingCount = orders.filter((o) => o.status === 'pending').length

  async function handleStatusChange(orderId: number, newStatus: Order['status']) {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: orderId, status: newStatus }),
      })
      if (!res.ok) throw new Error('API error')
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o))
      toast.success(`Đã cập nhật trạng thái → ${statusConfig[newStatus].label}`)
    } catch {
      toast.error('Không thể cập nhật trạng thái')
    }
  }

  function handleExport() {
    const csv = [
      'Mã đơn,Email,Tổng,Trạng thái,Phương thức,Ngày tạo',
      ...orders.map((o) =>
        `${o.orderNumber},${o.email},${o.total},${o.status},${o.method},${o.createdAt}`
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Đã xuất file CSV')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-warning" />
            Quản lý đơn hàng
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {orders.length} đơn hàng — Doanh thu: {formatVND(revenue)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/quan-ly/don-hang/doanh-thu">
            <Button size="sm" variant="outline" title="Xem doanh thu sản phẩm theo ngày/tháng/năm">
              <TrendingUp className="mr-1.5 h-3.5 w-3.5 text-success" />
              Doanh thu sản phẩm
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={orders.length === 0}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            Xuất CSV
          </Button>
        </div>
      </div>

      {/* Order lookup — admin enters an order code to see customer info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ScanSearch className="h-4 w-4 text-primary" />
            Kiểm tra mã đơn hàng
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Nhập chính xác mã đơn hàng để xem thông tin tài khoản khách hàng đã đặt đơn đó.
          </p>
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => { e.preventDefault(); runLookup() }}
          >
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value)}
                placeholder="Ví dụ: TVS-20250110-ABC123"
                className="pl-9 bg-background font-mono"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={lookupLoading || !lookupCode.trim()}>
              {lookupLoading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-1.5" />
              )}
              Kiểm tra
            </Button>
            {lookupResult && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => { setLookupResult(null); setLookupError(null); setLookupCode('') }}
                title="Đóng kết quả"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </form>

          {lookupError && !lookupResult && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {lookupError}
            </div>
          )}

          {lookupResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Order details */}
              <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Đơn hàng
                  </p>
                  <Badge variant="outline" className={`text-[10px] ${
                    statusConfig[lookupResult.order.status as keyof typeof statusConfig]?.bg || ''
                  } ${statusConfig[lookupResult.order.status as keyof typeof statusConfig]?.color || ''}`}>
                    {statusConfig[lookupResult.order.status as keyof typeof statusConfig]?.label || lookupResult.order.status}
                  </Badge>
                </div>
                <p className="font-mono text-sm font-bold text-primary">
                  {lookupResult.order.orderNumber}
                </p>
                <div className="text-xs space-y-1 pt-1 border-t border-border/50">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tổng tiền</span>
                    <span className="font-bold text-primary">{formatVND(lookupResult.order.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phương thức</span>
                    <span className="font-medium">{lookupResult.order.method || '—'}</span>
                  </div>
                  {lookupResult.order.transactionId && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Mã giao dịch</span>
                      <span className="font-mono text-[10px] truncate">{lookupResult.order.transactionId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tạo lúc</span>
                    <span>{formatVNDateTime(lookupResult.order.createdAt)}</span>
                  </div>
                  {lookupResult.order.paidAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Thanh toán</span>
                      <span>{formatVNDateTime(lookupResult.order.paidAt)}</span>
                    </div>
                  )}
                </div>
                {lookupResult.order.items.length > 0 && (
                  <div className="pt-2 border-t border-border/50 space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase">Sản phẩm</p>
                    {lookupResult.order.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-xs gap-2">
                        <span className="truncate flex items-center gap-1">
                          <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                          {it.name}
                        </span>
                        <span className="font-medium shrink-0">{formatVND(it.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer info */}
              <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tài khoản khách hàng
                </p>
                {lookupResult.customer ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">
                          {lookupResult.customer.displayName || lookupResult.customer.email || `#${lookupResult.customer.id}`}
                        </p>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {lookupResult.customer.role}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs space-y-1 pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{lookupResult.customer.email || '—'}</span>
                      </div>
                      {lookupResult.customer.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{lookupResult.customer.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Wallet className="h-3 w-3 text-success" />
                        <span className="text-muted-foreground">Số dư:</span>
                        <span className="font-bold text-success">{formatVND(lookupResult.customer.balance)}</span>
                      </div>
                      {lookupResult.customer.createdAt && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Đăng ký: {formatVNDateTime(lookupResult.customer.createdAt)}</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border/50">
                      <div className="text-center rounded bg-muted/50 p-1.5">
                        <p className="text-[9px] text-muted-foreground uppercase">Tổng đơn</p>
                        <p className="text-sm font-bold">{lookupResult.customer.stats.totalOrders}</p>
                      </div>
                      <div className="text-center rounded bg-success/10 p-1.5">
                        <p className="text-[9px] text-muted-foreground uppercase">Đã trả</p>
                        <p className="text-sm font-bold text-success">{lookupResult.customer.stats.paidOrders}</p>
                      </div>
                      <div className="text-center rounded bg-warning/10 p-1.5">
                        <p className="text-[9px] text-muted-foreground uppercase">Chờ xử lý</p>
                        <p className="text-sm font-bold text-warning">{lookupResult.customer.stats.pendingOrders}</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs pt-1">
                      <span className="text-muted-foreground">Đã chi:</span>
                      <span className="font-bold text-primary">{formatVND(lookupResult.customer.stats.totalSpent)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Đơn hàng này không liên kết với tài khoản nào.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Đã thanh toán</p>
            <p className="text-lg font-bold text-success">{paidCount}</p>
          </CardContent>
        </Card>
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Chờ xử lý</p>
            <p className="text-lg font-bold text-warning">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Doanh thu</p>
            <p className="text-lg font-bold text-primary">{formatVND(revenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Tìm theo mã đơn hoặc email..."
            className="pl-9 bg-muted/50"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'paid', 'pending', 'failed'].map((s) => {
            const cfg = s === 'all' ? null : statusConfig[s as keyof typeof statusConfig]
            return (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                  filterStatus === s
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted/30 border-border text-muted-foreground'
                }`}
              >
                {s === 'all' ? 'Tất cả' : cfg?.label}
              </button>
            )
          })}
          <button
            onClick={() => setSortDesc(!sortDesc)}
            className="px-2 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:text-foreground"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Đang tải đơn hàng...</span>
        </div>
      ) : (() => {
        const { paged: pagedOrders, totalPages } = paginate(filtered, page, ITEMS_PER_PAGE)
        return (<>
      {filtered.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">
              {orders.length === 0 ? 'Chưa có đơn hàng' : 'Không tìm thấy kết quả'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pagedOrders.map((order) => {
            const st = statusConfig[order.status] || statusConfig.pending
            const StatusIcon = st.icon
            return (
              <Card key={order.id} className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-mono font-bold text-sm">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{order.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${st.bg} ${st.color} text-xs shrink-0`}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {st.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground truncate mr-2">
                          <Package className="inline h-3 w-3 mr-1" />
                          {item.name}
                        </span>
                        <span className="font-medium shrink-0">{formatVND(item.price)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {order.method}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <p className="font-bold text-primary">{formatVND(order.total)}</p>
                  </div>

                  {/* Status actions */}
                  <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground mr-1">Chuyển trạng thái:</span>
                    {(['paid', 'pending', 'failed'] as const).map((s) => {
                      if (s === order.status) return null
                      const cfg = statusConfig[s]
                      return (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(order.id, s)}
                          className={`px-2 py-1 rounded text-[10px] font-medium border ${cfg.bg} ${cfg.color} hover:opacity-80 transition-opacity`}
                        >
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      <AdminPagination
        currentPage={page} totalPages={totalPages}
        totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setPage}
      />
      </>)
      })()}
    </div>
  )
}
