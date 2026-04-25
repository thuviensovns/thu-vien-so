'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp, RefreshCw, Loader2, ArrowLeft, CalendarDays,
  CalendarRange, Calendar, Filter, CheckCircle2, Package, Hash,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatVND } from '@/lib/format'

interface Bucket { revenue: number; units: number }
interface DailyCell extends Bucket { day: number }
interface MonthlyCell extends Bucket { month: number }
interface YearlyCell extends Bucket { year: number }
interface ProductRow { productId: number; productName: string; units: number; revenue: number }

interface PRResponse {
  year: number
  month: number
  day: number | null
  scope: 'day' | 'month' | 'year' | 'all'
  products: ProductRow[]
  daily: DailyCell[]
  monthly: MonthlyCell[]
  yearly: YearlyCell[]
  totals: {
    today: { revenue: number; units: number; distinctProducts: number }
    month: { revenue: number; units: number; distinctProducts: number }
    year: { revenue: number; units: number; distinctProducts: number }
    allTime: { revenue: number; units: number; distinctProducts: number }
  }
}

const VN_TZ = 'Asia/Ho_Chi_Minh'

function getCurrentVNDate() {
  const s = new Date().toLocaleString('en-US', { timeZone: VN_TZ })
  return new Date(s)
}

function formatCompactVND(amount: number): string {
  if (amount === 0) return '–'
  if (amount < 0) return '−' + formatCompactVND(-amount)
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(amount >= 10_000_000_000 ? 0 : 1)}B`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`
  return `${amount}`
}

function heatClass(amount: number, max: number): string {
  if (amount <= 0 || max <= 0) return 'bg-muted/20 text-muted-foreground'
  const ratio = amount / max
  if (ratio >= 0.8) return 'bg-success/40 text-success-foreground border-success/60 font-bold'
  if (ratio >= 0.6) return 'bg-success/30 text-foreground border-success/50 font-semibold'
  if (ratio >= 0.4) return 'bg-success/20 text-foreground border-success/40 font-semibold'
  if (ratio >= 0.2) return 'bg-success/15 text-foreground border-success/30'
  return 'bg-success/10 text-foreground border-success/20'
}

const MONTH_LABELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
const MONTH_LABELS_FULL = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

export default function ProductRevenuePage() {
  const nowVN = useMemo(() => getCurrentVNDate(), [])
  const [year, setYear] = useState(nowVN.getFullYear())
  const [month, setMonth] = useState(nowVN.getMonth() + 1)
  const [day, setDay] = useState<number | null>(null)
  const [scope, setScope] = useState<'day' | 'month' | 'year' | 'all'>('month')
  const [data, setData] = useState<PRResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        scope,
      })
      if (scope === 'day' && day) params.set('day', String(day))
      const res = await fetch(`/api/admin/orders/product-revenue?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.ok) setData(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
    setRefreshing(false)
  }, [year, month, day, scope])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto refresh 30s
  useEffect(() => {
    const id = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(id)
  }, [fetchData])

  const todayDay = nowVN.getDate()
  const todayMonth = nowVN.getMonth() + 1
  const todayYear = nowVN.getFullYear()

  const maxDaily = useMemo(() => Math.max(0, ...(data?.daily || []).map((d) => d.revenue)), [data])
  const maxMonthly = useMemo(() => Math.max(0, ...(data?.monthly || []).map((m) => m.revenue)), [data])
  const maxYearly = useMemo(() => Math.max(0, ...(data?.yearly || []).map((y) => y.revenue)), [data])
  const maxProductRevenue = useMemo(() => Math.max(0, ...(data?.products || []).map((p) => p.revenue)), [data])

  const yearOptions = useMemo(() => {
    const years = new Set<number>()
    years.add(nowVN.getFullYear())
    if (data?.yearly) for (const y of data.yearly) years.add(y.year)
    if (year) years.add(year)
    return Array.from(years).sort((a, b) => b - a)
  }, [data, year, nowVN])

  const daysInSelectedMonth = useMemo(
    () => new Date(year, month, 0).getDate(),
    [year, month],
  )

  const scopeLabel = useMemo(() => {
    if (scope === 'day' && day) return `Ngày ${day}/${month}/${year}`
    if (scope === 'month') return `${MONTH_LABELS_FULL[month - 1]} / ${year}`
    if (scope === 'year') return `Cả năm ${year}`
    return 'Tất cả thời gian'
  }, [scope, day, month, year])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/quan-ly/don-hang">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Doanh thu sản phẩm
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-9">
            Top sản phẩm bán chạy + bảng lịch ngày/tháng/năm — đồng bộ DB orders.status=&apos;paid&apos;
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => fetchData(true)} disabled={refreshing} title="Làm mới">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filter bar */}
      <Card className="border-border bg-muted/20">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Phạm vi sản phẩm:</span>
            </div>
            {([
              { v: 'day', label: 'Theo ngày' },
              { v: 'month', label: 'Theo tháng' },
              { v: 'year', label: 'Theo năm' },
              { v: 'all', label: 'Tất cả' },
            ] as const).map((opt) => (
              <Button
                key={opt.v}
                size="sm"
                variant={scope === opt.v ? 'default' : 'outline'}
                className="text-xs h-7 px-2.5"
                onClick={() => {
                  setScope(opt.v)
                  if (opt.v === 'day' && !day) setDay(todayDay)
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">Năm:</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {scope !== 'all' && scope !== 'year' && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Tháng:</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                >
                  {MONTH_LABELS_FULL.map((label, i) => (
                    <option key={i + 1} value={i + 1}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {scope === 'day' && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Ngày:</label>
                <select
                  value={day || todayDay}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                >
                  {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>Ngày {d}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="ml-auto text-xs text-muted-foreground">
              Hiển thị: <span className="font-semibold text-foreground">{scopeLabel}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Đang tổng hợp doanh thu sản phẩm...</p>
        </div>
      ) : !data ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive">Không tải được dữ liệu.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Hôm nay"
              revenue={data.totals.today.revenue}
              units={data.totals.today.units}
              distinctProducts={data.totals.today.distinctProducts}
              accent="text-success" border="border-success/30" bg="bg-success/5"
            />
            <StatCard
              label={`${MONTH_LABELS_FULL[month - 1]} / ${year}`}
              revenue={data.totals.month.revenue}
              units={data.totals.month.units}
              distinctProducts={data.totals.month.distinctProducts}
              accent="text-primary" border="border-primary/30" bg="bg-primary/5"
            />
            <StatCard
              label={`Cả năm ${year}`}
              revenue={data.totals.year.revenue}
              units={data.totals.year.units}
              distinctProducts={data.totals.year.distinctProducts}
              accent="text-warning" border="border-warning/30" bg="bg-warning/5"
            />
            <StatCard
              label="Tất cả thời gian"
              revenue={data.totals.allTime.revenue}
              units={data.totals.allTime.units}
              distinctProducts={data.totals.allTime.distinctProducts}
              accent="text-foreground" border="border-border" bg="bg-muted/20"
            />
          </div>

          {/* Top products table */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Package className="h-4 w-4 text-success" />
                  Sản phẩm bán chạy — {scopeLabel}
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  {data.products.length} sản phẩm
                </Badge>
              </div>

              {data.products.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Chưa có đơn hàng nào trong phạm vi này.
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-12">#</th>
                        <th className="text-left py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sản phẩm</th>
                        <th className="text-right py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-24">Lượt bán</th>
                        <th className="text-right py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-32">Doanh thu</th>
                        <th className="text-left py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-32">Tỷ trọng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.products.map((p, idx) => {
                        const pct = maxProductRevenue > 0 ? (p.revenue / maxProductRevenue) * 100 : 0
                        const totalRevForScope = data.products.reduce((s, x) => s + x.revenue, 0)
                        const sharePct = totalRevForScope > 0 ? (p.revenue / totalRevForScope) * 100 : 0
                        return (
                          <tr key={p.productId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-2 px-2 font-mono text-muted-foreground">
                              {idx === 0 ? <span className="text-warning font-bold">🥇</span> :
                                idx === 1 ? <span className="text-muted-foreground font-bold">🥈</span> :
                                  idx === 2 ? <span className="text-warning/60 font-bold">🥉</span> :
                                    <span>{idx + 1}</span>}
                            </td>
                            <td className="py-2 px-2">
                              <p className="font-medium truncate max-w-md" title={p.productName}>
                                {p.productName}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">ID: {p.productId}</p>
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              <span className="inline-flex items-center gap-1">
                                <Hash className="h-3 w-3 text-muted-foreground" />
                                {p.units}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-success">
                              {formatVND(p.revenue)}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-success transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground font-mono w-9 text-right">
                                  {sharePct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily heatmap */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-success" />
                  Doanh thu theo ngày — {MONTH_LABELS_FULL[month - 1]} / {year}
                </h3>
                <div className="text-xs text-muted-foreground">
                  Tổng: <span className="font-bold text-foreground">{formatVND(data.totals.month.revenue)}</span>
                  <span className="mx-1.5">•</span>
                  <span>{data.totals.month.units} đơn</span>
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 px-4">
                <table className="border-collapse text-center text-xs" style={{ minWidth: data.daily.length * 60 }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-[70px] z-10">
                        Ngày
                      </th>
                      {data.daily.map((d) => {
                        const isToday = year === todayYear && month === todayMonth && d.day === todayDay
                        const isSelected = scope === 'day' && day === d.day
                        return (
                          <th
                            key={d.day}
                            onClick={() => { setScope('day'); setDay(d.day) }}
                            className={`border border-border px-1.5 py-1.5 font-semibold w-[60px] cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : isToday
                                  ? 'bg-success/30 text-foreground'
                                  : 'bg-muted/40 hover:bg-muted'
                            }`}
                          >
                            {d.day}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold z-10">
                        VND
                      </td>
                      {data.daily.map((d) => {
                        const isToday = year === todayYear && month === todayMonth && d.day === todayDay
                        return (
                          <td
                            key={d.day}
                            onClick={() => { setScope('day'); setDay(d.day) }}
                            title={`Ngày ${d.day}/${month}/${year}: ${formatVND(d.revenue)} (${d.units} đơn)`}
                            className={`border px-1 py-2 cursor-pointer transition-colors ${heatClass(d.revenue, maxDaily)} ${
                              isToday ? 'ring-2 ring-primary ring-inset' : ''
                            }`}
                          >
                            <div className="font-mono text-[11px] leading-tight">{formatCompactVND(d.revenue)}</div>
                            {d.units > 0 && (
                              <div className="text-[9px] opacity-60 leading-none mt-0.5">{d.units}</div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Bấm vào ô ngày để xem sản phẩm bán trong ngày đó. Số dưới = số đơn (line items).
              </p>
            </CardContent>
          </Card>

          {/* Monthly heatmap */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-primary" />
                  Doanh thu theo tháng — {year}
                </h3>
                <div className="text-xs text-muted-foreground">
                  Tổng: <span className="font-bold text-foreground">{formatVND(data.totals.year.revenue)}</span>
                  <span className="mx-1.5">•</span>
                  <span>{data.totals.year.units} đơn</span>
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 px-4">
                <table className="border-collapse text-center text-xs w-full min-w-[720px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-[70px] z-10">Tháng</th>
                      {data.monthly.map((m) => {
                        const isCurrent = year === todayYear && m.month === todayMonth
                        const isSelected = m.month === month
                        return (
                          <th
                            key={m.month}
                            onClick={() => { setMonth(m.month); setScope('month') }}
                            className={`border border-border px-2 py-1.5 font-semibold cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : isCurrent
                                  ? 'bg-success/20 text-foreground'
                                  : 'bg-muted/40 hover:bg-muted'
                            }`}
                          >
                            {MONTH_LABELS[m.month - 1]}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold z-10">VND</td>
                      {data.monthly.map((m) => (
                        <td
                          key={m.month}
                          onClick={() => { setMonth(m.month); setScope('month') }}
                          title={`${MONTH_LABELS_FULL[m.month - 1]} / ${year}: ${formatVND(m.revenue)} (${m.units} đơn)`}
                          className={`border px-2 py-2.5 cursor-pointer transition-colors ${heatClass(m.revenue, maxMonthly)} ${
                            m.month === month ? 'ring-2 ring-primary ring-inset' : ''
                          }`}
                        >
                          <div className="font-mono text-[12px] leading-tight">{formatCompactVND(m.revenue)}</div>
                          {m.units > 0 && (
                            <div className="text-[9px] opacity-60 leading-none mt-0.5">{m.units} đơn</div>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold z-10">Tỷ trọng</td>
                      {data.monthly.map((m) => {
                        const pct = data.totals.year.revenue > 0 ? Math.round((m.revenue / data.totals.year.revenue) * 100) : 0
                        return (
                          <td key={m.month} className="border border-border px-1 py-1 bg-muted/10">
                            <div className="font-mono text-[10px] text-muted-foreground">{pct}%</div>
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Bấm vào ô tháng để xem sản phẩm bán trong tháng đó.
              </p>
            </CardContent>
          </Card>

          {/* Yearly heatmap */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-warning" />
                  Doanh thu theo năm
                </h3>
                <div className="text-xs text-muted-foreground">
                  Tổng tất cả: <span className="font-bold text-foreground">{formatVND(data.totals.allTime.revenue)}</span>
                  <span className="mx-1.5">•</span>
                  <span>{data.totals.allTime.units} đơn</span>
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 px-4">
                <table className="border-collapse text-center text-xs w-full" style={{ minWidth: Math.max(720, data.yearly.length * 120) }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-[70px] z-10">Năm</th>
                      {data.yearly.map((y) => {
                        const isCurrent = y.year === todayYear
                        const isSelected = y.year === year
                        return (
                          <th
                            key={y.year}
                            onClick={() => { setYear(y.year); setScope('year') }}
                            className={`border border-border px-3 py-1.5 font-semibold cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : isCurrent
                                  ? 'bg-success/20 text-foreground'
                                  : 'bg-muted/40 hover:bg-muted'
                            }`}
                          >
                            {y.year}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold z-10">VND</td>
                      {data.yearly.map((y) => (
                        <td
                          key={y.year}
                          onClick={() => { setYear(y.year); setScope('year') }}
                          title={`Năm ${y.year}: ${formatVND(y.revenue)} (${y.units} đơn)`}
                          className={`border px-3 py-3 cursor-pointer transition-colors ${heatClass(y.revenue, maxYearly)} ${
                            y.year === year ? 'ring-2 ring-primary ring-inset' : ''
                          }`}
                        >
                          <div className="font-mono text-sm leading-tight">{formatCompactVND(y.revenue)}</div>
                          {y.units > 0 && (
                            <div className="text-[10px] opacity-60 leading-none mt-1">{y.units} đơn</div>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold z-10">Tỷ trọng</td>
                      {data.yearly.map((y) => {
                        const pct = data.totals.allTime.revenue > 0 ? Math.round((y.revenue / data.totals.allTime.revenue) * 100) : 0
                        return (
                          <td key={y.year} className="border border-border px-2 py-1 bg-muted/10">
                            <div className="font-mono text-[11px] text-muted-foreground">{pct}%</div>
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Bấm vào ô năm để xem sản phẩm bán cả năm đó.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-success" />
            <span>
              Đồng bộ DB orders.status=&apos;paid&apos; ({VN_TZ}) — auto refresh 30s
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  label, revenue, units, distinctProducts, accent, border, bg,
}: {
  label: string; revenue: number; units: number; distinctProducts: number
  accent: string; border: string; bg: string
}) {
  return (
    <Card className={`${border} ${bg}`}>
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className={`text-base font-bold mt-1 ${accent} font-mono leading-tight`}>{formatVND(revenue)}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          <span>{units} đơn</span>
          <span>•</span>
          <span>{distinctProducts} SP</span>
        </div>
      </CardContent>
    </Card>
  )
}
