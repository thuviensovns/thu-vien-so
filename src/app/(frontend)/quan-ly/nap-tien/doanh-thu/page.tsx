'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp, RefreshCw, Loader2, ArrowLeft, CalendarDays,
  CalendarRange, Calendar, Filter, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatVND } from '@/lib/format'

interface Bucket { amount: number; count: number }
interface DailyCell extends Bucket { day: number }
interface MonthlyCell extends Bucket { month: number }
interface YearlyCell extends Bucket { year: number }

interface RevenueResponse {
  year: number
  month: number
  includeAffiliate: boolean
  daily: DailyCell[]
  monthly: MonthlyCell[]
  yearly: YearlyCell[]
  totals: {
    today: Bucket
    month: Bucket
    year: Bucket
    allTime: Bucket
  }
}

const VN_TZ = 'Asia/Ho_Chi_Minh'

function getCurrentVNDate() {
  const s = new Date().toLocaleString('en-US', { timeZone: VN_TZ })
  return new Date(s)
}

/** Compact VND format for table cells: 1.234.567đ → "1.2M", 50.000đ → "50K".
 *  Negative values get "−" prefix (refund-heavy buckets with DEDUCT > deposits). */
function formatCompactVND(amount: number): string {
  if (amount === 0) return '–'
  if (amount < 0) return '−' + formatCompactVND(-amount)
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(amount >= 10_000_000_000 ? 0 : 1)}B`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`
  return `${amount}`
}

/** Heatmap intensity. Positive = green (revenue); negative = red (refunds
 *  exceeded deposits). max is the absolute peak of the bucket so signed
 *  ratios share the same scale. */
function heatClass(amount: number, max: number): string {
  if (amount === 0 || max <= 0) return 'bg-muted/20 text-muted-foreground'
  if (amount < 0) {
    const ratio = Math.abs(amount) / max
    if (ratio >= 0.6) return 'bg-destructive/40 text-foreground border-destructive/60 font-bold'
    if (ratio >= 0.3) return 'bg-destructive/25 text-foreground border-destructive/50 font-semibold'
    return 'bg-destructive/15 text-foreground border-destructive/30'
  }
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

export default function RevenueAnalyticsPage() {
  const nowVN = useMemo(() => getCurrentVNDate(), [])
  const [year, setYear] = useState(nowVN.getFullYear())
  const [month, setMonth] = useState(nowVN.getMonth() + 1)
  const [includeAffiliate, setIncludeAffiliate] = useState(false)
  const [data, setData] = useState<RevenueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRevenue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        includeAffiliate: includeAffiliate ? '1' : '0',
      })
      const res = await fetch(`/api/admin/topups/revenue?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.ok) {
        const json = (await res.json()) as RevenueResponse
        setData(json)
      }
    } catch { /* ignore */ }
    setLoading(false)
    setRefreshing(false)
  }, [year, month, includeAffiliate])

  useEffect(() => {
    fetchRevenue()
  }, [fetchRevenue])

  // Auto-refresh every 30s to stay in sync with new completed topups
  useEffect(() => {
    const interval = setInterval(() => fetchRevenue(true), 30000)
    return () => clearInterval(interval)
  }, [fetchRevenue])

  const todayDay = nowVN.getDate()
  const todayMonth = nowVN.getMonth() + 1
  const todayYear = nowVN.getFullYear()

  // Use abs() so negative buckets (refund-heavy days) still scale heatmap
  // intensity proportional to the period's peak.
  const maxDaily = useMemo(() => Math.max(0, ...(data?.daily || []).map((d) => Math.abs(d.amount))), [data])
  const maxMonthly = useMemo(() => Math.max(0, ...(data?.monthly || []).map((m) => Math.abs(m.amount))), [data])
  const maxYearly = useMemo(() => Math.max(0, ...(data?.yearly || []).map((y) => Math.abs(y.amount))), [data])

  // Available years for selector: range from earliest yearly bucket to current+0
  const yearOptions = useMemo(() => {
    const years = new Set<number>()
    years.add(nowVN.getFullYear())
    if (data?.yearly) for (const y of data.yearly) years.add(y.year)
    if (year) years.add(year)
    return Array.from(years).sort((a, b) => b - a)
  }, [data, year, nowVN])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/quan-ly/nap-tien">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Doanh thu nạp tiền
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-9">
            Bảng lịch theo ngày / tháng / năm — đồng bộ trực tiếp từ DB
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchRevenue(true)}
            disabled={refreshing}
            title="Làm mới"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="border-border bg-muted/20">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Bộ lọc:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Năm:</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

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

          <label className="flex items-center gap-1.5 ml-auto cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={includeAffiliate}
              onChange={(e) => setIncludeAffiliate(e.target.checked)}
              className="h-3.5 w-3.5 rounded"
            />
            <span className="text-muted-foreground">Bao gồm hoa hồng affiliate (COMM)</span>
          </label>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Đang tổng hợp doanh thu...</p>
        </div>
      ) : !data ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive">Không tải được dữ liệu doanh thu.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats — 4 horizontal cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Hôm nay"
              amount={data.totals.today.amount}
              count={data.totals.today.count}
              accent="text-success"
              border="border-success/30"
              bg="bg-success/5"
            />
            <StatCard
              label={MONTH_LABELS_FULL[month - 1] + ` / ${year}`}
              amount={data.totals.month.amount}
              count={data.totals.month.count}
              accent="text-primary"
              border="border-primary/30"
              bg="bg-primary/5"
            />
            <StatCard
              label={`Cả năm ${year}`}
              amount={data.totals.year.amount}
              count={data.totals.year.count}
              accent="text-warning"
              border="border-warning/30"
              bg="bg-warning/5"
            />
            <StatCard
              label="Tất cả thời gian"
              amount={data.totals.allTime.amount}
              count={data.totals.allTime.count}
              accent="text-foreground"
              border="border-border"
              bg="bg-muted/20"
            />
          </div>

          {/* Daily horizontal calendar */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-success" />
                  Doanh thu theo ngày — {MONTH_LABELS_FULL[month - 1]} / {year}
                </h3>
                <div className="text-xs text-muted-foreground">
                  Tổng: <span className="font-bold text-foreground">{formatVND(data.totals.month.amount)}</span>
                  <span className="mx-1.5">•</span>
                  <span>{data.totals.month.count} GD</span>
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
                        return (
                          <th
                            key={d.day}
                            className={`border border-border px-1.5 py-1.5 font-semibold w-[60px] ${
                              isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/40'
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
                            title={`Ngày ${d.day}/${month}/${year}: ${formatVND(d.amount)} (${d.count} GD)`}
                            className={`border px-1 py-2 transition-colors ${heatClass(d.amount, maxDaily)} ${
                              isToday ? 'ring-2 ring-primary ring-inset' : ''
                            }`}
                          >
                            <div className="font-mono text-[11px] leading-tight">{formatCompactVND(d.amount)}</div>
                            {d.count > 0 && (
                              <div className="text-[9px] opacity-60 leading-none mt-0.5">{d.count} GD</div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Cường độ màu theo doanh thu cao nhất trong tháng. Hover ô để xem chi tiết. K = nghìn, M = triệu, B = tỉ.
              </p>
            </CardContent>
          </Card>

          {/* Monthly horizontal calendar */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-primary" />
                  Doanh thu theo tháng — {year}
                </h3>
                <div className="text-xs text-muted-foreground">
                  Tổng: <span className="font-bold text-foreground">{formatVND(data.totals.year.amount)}</span>
                  <span className="mx-1.5">•</span>
                  <span>{data.totals.year.count} GD</span>
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 px-4">
                <table className="border-collapse text-center text-xs w-full min-w-[720px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-[70px] z-10">
                        Tháng
                      </th>
                      {data.monthly.map((m) => {
                        const isCurrent = year === todayYear && m.month === todayMonth
                        const isSelected = m.month === month
                        return (
                          <th
                            key={m.month}
                            onClick={() => setMonth(m.month)}
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
                      <td className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold z-10">
                        VND
                      </td>
                      {data.monthly.map((m) => (
                        <td
                          key={m.month}
                          onClick={() => setMonth(m.month)}
                          title={`${MONTH_LABELS_FULL[m.month - 1]} / ${year}: ${formatVND(m.amount)} (${m.count} GD)`}
                          className={`border px-2 py-2.5 cursor-pointer transition-colors ${heatClass(m.amount, maxMonthly)} ${
                            m.month === month ? 'ring-2 ring-primary ring-inset' : ''
                          }`}
                        >
                          <div className="font-mono text-[12px] leading-tight">{formatCompactVND(m.amount)}</div>
                          {m.count > 0 && (
                            <div className="text-[9px] opacity-60 leading-none mt-0.5">{m.count} GD</div>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold z-10">
                        Tỷ trọng
                      </td>
                      {data.monthly.map((m) => {
                        const pct = data.totals.year.amount > 0
                          ? Math.round((m.amount / data.totals.year.amount) * 100)
                          : 0
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
                Bấm vào ô tháng để xem chi tiết theo ngày của tháng đó.
              </p>
            </CardContent>
          </Card>

          {/* Yearly horizontal calendar */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-warning" />
                  Doanh thu theo năm
                </h3>
                <div className="text-xs text-muted-foreground">
                  Tổng tất cả: <span className="font-bold text-foreground">{formatVND(data.totals.allTime.amount)}</span>
                  <span className="mx-1.5">•</span>
                  <span>{data.totals.allTime.count} GD</span>
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 px-4">
                <table className="border-collapse text-center text-xs w-full" style={{ minWidth: Math.max(720, data.yearly.length * 120) }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-[70px] z-10">
                        Năm
                      </th>
                      {data.yearly.map((y) => {
                        const isCurrent = y.year === todayYear
                        const isSelected = y.year === year
                        return (
                          <th
                            key={y.year}
                            onClick={() => setYear(y.year)}
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
                      <td className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold z-10">
                        VND
                      </td>
                      {data.yearly.map((y) => (
                        <td
                          key={y.year}
                          onClick={() => setYear(y.year)}
                          title={`Năm ${y.year}: ${formatVND(y.amount)} (${y.count} GD)`}
                          className={`border px-3 py-3 cursor-pointer transition-colors ${heatClass(y.amount, maxYearly)} ${
                            y.year === year ? 'ring-2 ring-primary ring-inset' : ''
                          }`}
                        >
                          <div className="font-mono text-sm leading-tight">{formatCompactVND(y.amount)}</div>
                          {y.count > 0 && (
                            <div className="text-[10px] opacity-60 leading-none mt-1">{y.count} GD</div>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="sticky left-0 bg-card border border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold z-10">
                        Tỷ trọng
                      </td>
                      {data.yearly.map((y) => {
                        const pct = data.totals.allTime.amount > 0
                          ? Math.round((y.amount / data.totals.allTime.amount) * 100)
                          : 0
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
                Bấm vào ô năm để xem chi tiết tháng/ngày của năm đó.
              </p>
            </CardContent>
          </Card>

          {/* Sync indicator */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-success" />
            <span>
              Dữ liệu đồng bộ từ Postgres ({VN_TZ}) — auto refresh mỗi 30s •{' '}
              {includeAffiliate ? 'Bao gồm' : 'Loại trừ'} hoa hồng affiliate
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  label, amount, count, accent, border, bg,
}: {
  label: string; amount: number; count: number; accent: string; border: string; bg: string
}) {
  // Negative bucket = refund/deduction exceeded deposits in period. Override
  // accent to destructive so admin spots it immediately instead of misreading
  // a green-styled negative number.
  const amountClass = amount < 0 ? 'text-destructive' : accent
  return (
    <Card className={`${border} ${bg}`}>
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className={`text-base font-bold mt-1 ${amountClass} font-mono leading-tight`}>{formatVND(amount)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{count} giao dịch</p>
      </CardContent>
    </Card>
  )
}
