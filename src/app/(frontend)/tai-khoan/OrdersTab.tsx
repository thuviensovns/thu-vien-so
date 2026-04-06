'use client'

import Link from 'next/link'
import {
  Package, Loader2, Clock, CheckCircle, XCircle, AlertCircle, ShoppingCart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatVND, formatDate } from '@/lib/format'

interface Order {
  id: string
  orderNumber: string
  total: number
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  createdAt: string
  items: Array<{ name?: string; productName?: string; price: number }>
  method?: string
  payment?: { method?: string }
}

const statusLabels: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: 'Chờ thanh toán', color: 'text-warning bg-warning/10 border-warning/20', icon: Clock },
  paid: { label: 'Đã thanh toán', color: 'text-success bg-success/10 border-success/20', icon: CheckCircle },
  failed: { label: 'Thất bại', color: 'text-destructive bg-destructive/10 border-destructive/20', icon: XCircle },
  refunded: { label: 'Hoàn tiền', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', icon: AlertCircle },
}

interface OrdersTabProps {
  orders: Order[]
  loading: boolean
  onRefresh: () => void
}

export default function OrdersTab({ orders, loading, onRefresh }: OrdersTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold">Lịch sử đơn hàng</h2>
        <Button variant="ghost" size="sm" className="text-xs" onClick={onRefresh}>Làm mới</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Chưa có đơn hàng nào</p>
          <p className="text-xs text-muted-foreground mt-1">Mua sản phẩm đầu tiên ngay!</p>
          <Button asChild className="mt-4" variant="outline" size="sm">
            <Link href="/san-pham"><ShoppingCart className="mr-1.5 h-3.5 w-3.5" />Khám phá sản phẩm</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo = statusLabels[order.status] || statusLabels.pending
            const StatusIcon = statusInfo.icon
            const methodLabel = order.method || order.payment?.method || ''
            return (
              <div key={order.id} className="p-3 sm:p-4 rounded-lg border border-border hover:border-border/80 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-primary font-bold">{order.orderNumber}</span>
                    <Badge className={`text-[10px] border ${statusInfo.color}`}>
                      <StatusIcon className="h-2.5 w-2.5 mr-0.5" />{statusInfo.label}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                </div>
                <div className="space-y-1">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate mr-2">{item.name || item.productName}</span>
                      <span className="shrink-0">{formatVND(item.price)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Tổng: <span className="text-primary">{formatVND(order.total)}</span></span>
                  {methodLabel && <Badge variant="outline" className="text-[10px]">{methodLabel}</Badge>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export type { Order }
