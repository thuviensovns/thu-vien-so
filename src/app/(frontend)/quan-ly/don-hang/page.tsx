'use client'

import { useState, useMemo } from 'react'
import {
  ShoppingCart, Package, Calendar, CreditCard, Search,
  CheckCircle2, Clock, XCircle, AlertCircle, Filter,
  ArrowUpDown, FileDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatVND, formatDate } from '@/lib/format'
import { getDemoOrders, updateOrderStatus, saveDemoOrders, logActivity, type DemoOrder } from '@/lib/admin-helpers'
import { toast } from 'sonner'
import AdminPagination, { paginate } from '@/components/admin/AdminPagination'

const ITEMS_PER_PAGE = 10

const statusConfig = {
  paid: { label: 'Đã thanh toán', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10 border-success/20' },
  pending: { label: 'Chờ xử lý', icon: Clock, color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
  failed: { label: 'Thất bại', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<DemoOrder[]>(() => getDemoOrders())
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(1)

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

  function handleStatusChange(orderId: string, newStatus: DemoOrder['status']) {
    updateOrderStatus(orderId, newStatus)
    setOrders(getDemoOrders())
    toast.success(`Đã cập nhật trạng thái → ${statusConfig[newStatus].label}`)
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
    logActivity('order', 'Xuất dữ liệu đơn hàng', `${orders.length} đơn hàng`)
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
        <Button size="sm" variant="outline" onClick={handleExport} disabled={orders.length === 0}>
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
          Xuất CSV
        </Button>
      </div>

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
      {(() => {
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
