'use client'

import { useState, useMemo } from 'react'
import {
  ScrollText, Trash2, Search, ShoppingCart, Users,
  Wallet, Tag, CreditCard, AlertCircle, Filter, Package,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getActivityLog, clearActivityLog, type ActivityEntry } from '@/lib/admin-helpers'
import { toast } from 'sonner'

const typeConfig: Record<string, { label: string; icon: typeof ShoppingCart; color: string; bg: string }> = {
  order: { label: 'Đơn hàng', icon: ShoppingCart, color: 'text-warning', bg: 'bg-warning/10' },
  user: { label: 'Người dùng', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  topup: { label: 'Nạp tiền', icon: Wallet, color: 'text-success', bg: 'bg-success/10' },
  coupon: { label: 'Giảm giá', icon: Tag, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  product: { label: 'Sản phẩm', icon: Package, color: 'text-primary', bg: 'bg-primary/10' },
  settings: { label: 'Cài đặt', icon: CreditCard, color: 'text-muted-foreground', bg: 'bg-muted/50' },
  system: { label: 'Hệ thống', icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted/50' },
}

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>(() => getActivityLog())
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  const filtered = useMemo(() => {
    let result = entries
    if (filterType !== 'all') {
      result = result.filter((e) => e.type === filterType)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((e) =>
        e.action.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q)
      )
    }
    return result
  }, [entries, search, filterType])

  function handleClear() {
    if (entries.length === 0) return
    clearActivityLog()
    setEntries([])
    toast.info('Đã xóa nhật ký hoạt động')
  }

  // Group entries by date
  const grouped = useMemo(() => {
    const map: Record<string, ActivityEntry[]> = {}
    filtered.forEach((entry) => {
      const date = entry.timestamp.slice(0, 10)
      if (!map[date]) map[date] = []
      map[date].push(entry)
    })
    return Object.entries(map)
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            Nhật ký hoạt động
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entries.length} hoạt động được ghi lại
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleClear} className="text-destructive hover:text-destructive">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Xóa tất cả
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm hoạt động..."
            className="pl-9 bg-muted/50"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
              filterType === 'all'
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <Filter className="inline h-3 w-3 mr-1" />
            Tất cả
          </button>
          {Object.entries(typeConfig).map(([key, cfg]) => {
            const Icon = cfg.icon
            return (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                  filterType === key
                    ? `${cfg.bg} border-current ${cfg.color}`
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="inline h-3 w-3 mr-1" />
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <ScrollText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">
              {entries.length === 0 ? 'Chưa có hoạt động nào' : 'Không tìm thấy kết quả'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Hoạt động sẽ được ghi lại tự động khi admin thao tác.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, dayEntries]) => (
            <div key={date}>
              <p className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                {new Date(date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
              <div className="space-y-1">
                {dayEntries.map((entry) => {
                  const cfg = typeConfig[entry.type] || typeConfig.system
                  const Icon = cfg.icon
                  return (
                    <div key={entry.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                      <div className={`h-7 w-7 rounded-md ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{entry.action}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.detail}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        {new Date(entry.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
