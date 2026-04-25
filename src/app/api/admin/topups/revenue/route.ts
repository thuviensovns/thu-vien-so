import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'

type Row = Record<string, unknown>

const VN_TZ = 'Asia/Ho_Chi_Minh'

/** Effective payment timestamp.
 *
 *  For DEDUCT* rows linked to an `original_topup_id`, the timestamp is read
 *  from the ORIGINAL topup so refunds/corrections land in the same calendar
 *  bucket as the credit they cancel — admin sees `cộng nhầm + trừ nhầm` net
 *  to 0 on the day the mistake was made, not split across two days.
 *
 *  Falls back to the row's own credited_at → confirmed_at → created_at chain
 *  when there's no link (legacy DEDUCTs without match, or non-DEDUCT rows).
 *  AT TIME ZONE converts UTC → VN local for day-boundary alignment. */
const TS_EXPR = `(COALESCE(orig.credited_at, orig.confirmed_at, orig.created_at, t.credited_at, t.confirmed_at, t.created_at) AT TIME ZONE '${VN_TZ}')`

/** Always LEFT JOIN the original topup for DEDUCT linkage. NULL for unlinked
 *  rows so the COALESCE in TS_EXPR falls through to t.* timestamps. */
const FROM_WITH_ORIG = `FROM topups t LEFT JOIN topups orig ON orig.id = t.original_topup_id`

/** GET: Aggregated topup revenue for admin analytics.
 *
 *  Returns daily/monthly/yearly buckets in one response so the UI can render
 *  three horizontal calendar tables without N+1 round-trips.
 *
 *  Query params (all optional):
 *    - year: target year for daily/monthly buckets (default: current VN year)
 *    - month: target month (1-12) for daily bucket (default: current VN month)
 *    - includeAffiliate: '1' to include COMM* affiliate credits in totals
 *      (default: excluded — those are internal commission credits, not real
 *      customer money in)
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: VN_TZ }))
    const yearParam = Number(req.nextUrl.searchParams.get('year')) || nowVN.getFullYear()
    const monthParam = Number(req.nextUrl.searchParams.get('month')) || (nowVN.getMonth() + 1)
    const includeAffiliate = req.nextUrl.searchParams.get('includeAffiliate') === '1'

    const year = Math.min(2100, Math.max(2020, yearParam))
    const month = Math.min(12, Math.max(1, monthParam))

    // Doanh thu = SUM(amount) all completed topups, COMM excluded by default.
    // Cơ chế: ADMIN cộng tay → +amount (tính là doanh thu); DEDUCT trừ tay
    // → -amount (lưu âm, tự nét ra). Cộng nhầm + trừ nhầm: ADMIN +X, DEDUCT
    // -X → SUM = 0 ("tiền không tồn tại"). Cộng tay legit, không trừ:
    // SUM = +X (tính doanh thu). Refund real bank: SUM = REAL + DEDUCT (-X)
    // = giảm doanh thu đúng. COMM là hoa hồng affiliate nội bộ, có toggle.
    const affiliateFilter = includeAffiliate ? '' : `AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')`
    const baseWhere = `t.status = 'completed' ${affiliateFilter}`

    const pool = getDbPool()

    const [
      { rows: dailyRows },
      { rows: monthlyRows },
      { rows: yearlyRows },
      { rows: totalsRows },
      { rows: todayRows },
    ] = await Promise.all([
      // Daily breakdown for the selected month
      pool.query<Row>(
        `SELECT EXTRACT(DAY FROM ${TS_EXPR})::int AS day,
                SUM(t.amount)::bigint AS amount,
                COUNT(*)::int AS count
         ${FROM_WITH_ORIG}
         WHERE ${baseWhere}
           AND EXTRACT(YEAR FROM ${TS_EXPR}) = $1
           AND EXTRACT(MONTH FROM ${TS_EXPR}) = $2
         GROUP BY day
         ORDER BY day`,
        [year, month],
      ),
      // Monthly breakdown for the selected year
      pool.query<Row>(
        `SELECT EXTRACT(MONTH FROM ${TS_EXPR})::int AS month,
                SUM(t.amount)::bigint AS amount,
                COUNT(*)::int AS count
         ${FROM_WITH_ORIG}
         WHERE ${baseWhere}
           AND EXTRACT(YEAR FROM ${TS_EXPR}) = $1
         GROUP BY month
         ORDER BY month`,
        [year],
      ),
      // Yearly breakdown across all years with data
      pool.query<Row>(
        `SELECT EXTRACT(YEAR FROM ${TS_EXPR})::int AS year,
                SUM(t.amount)::bigint AS amount,
                COUNT(*)::int AS count
         ${FROM_WITH_ORIG}
         WHERE ${baseWhere}
         GROUP BY year
         ORDER BY year`,
      ),
      // All-time totals (no time bucket — JOIN unnecessary but harmless and
      // keeps the WHERE clause uniform across all five queries)
      pool.query<Row>(
        `SELECT COALESCE(SUM(t.amount), 0)::bigint AS amount,
                COUNT(*)::int AS count
         ${FROM_WITH_ORIG}
         WHERE ${baseWhere}`,
      ),
      // Today's totals (VN day boundary)
      pool.query<Row>(
        `SELECT COALESCE(SUM(t.amount), 0)::bigint AS amount,
                COUNT(*)::int AS count
         ${FROM_WITH_ORIG}
         WHERE ${baseWhere}
           AND DATE(${TS_EXPR}) = (CURRENT_TIMESTAMP AT TIME ZONE '${VN_TZ}')::date`,
      ),
    ])

    // Build dense daily array (1..daysInMonth) so UI can render fixed-width grid
    const daysInMonth = new Date(year, month, 0).getDate()
    const dailyMap = new Map<number, { amount: number; count: number }>()
    for (const r of dailyRows) {
      dailyMap.set(Number(r.day), { amount: Number(r.amount || 0), count: Number(r.count || 0) })
    }
    const daily = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const cell = dailyMap.get(day)
      return { day, amount: cell?.amount || 0, count: cell?.count || 0 }
    })

    // Build dense monthly array (1..12)
    const monthlyMap = new Map<number, { amount: number; count: number }>()
    for (const r of monthlyRows) {
      monthlyMap.set(Number(r.month), { amount: Number(r.amount || 0), count: Number(r.count || 0) })
    }
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const cell = monthlyMap.get(m)
      return { month: m, amount: cell?.amount || 0, count: cell?.count || 0 }
    })

    // Yearly: include current year even if empty so the table never collapses
    const yearlyMap = new Map<number, { amount: number; count: number }>()
    for (const r of yearlyRows) {
      yearlyMap.set(Number(r.year), { amount: Number(r.amount || 0), count: Number(r.count || 0) })
    }
    const currentYear = nowVN.getFullYear()
    if (!yearlyMap.has(currentYear)) yearlyMap.set(currentYear, { amount: 0, count: 0 })
    const yearly = Array.from(yearlyMap.entries())
      .map(([y, v]) => ({ year: y, amount: v.amount, count: v.count }))
      .sort((a, b) => a.year - b.year)

    // Derived totals from already-computed buckets (no extra query needed)
    const monthAmount = monthly.find((m) => m.month === month)?.amount || 0
    const monthCount = monthly.find((m) => m.month === month)?.count || 0
    const yearAmount = monthly.reduce((s, m) => s + m.amount, 0)
    const yearCount = monthly.reduce((s, m) => s + m.count, 0)

    const res = NextResponse.json({
      year,
      month,
      includeAffiliate,
      daily,
      monthly,
      yearly,
      totals: {
        today: { amount: Number(todayRows[0]?.amount || 0), count: Number(todayRows[0]?.count || 0) },
        month: { amount: monthAmount, count: monthCount },
        year: { amount: yearAmount, count: yearCount },
        allTime: { amount: Number(totalsRows[0]?.amount || 0), count: Number(totalsRows[0]?.count || 0) },
      },
    })
    res.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
    return res
  } catch (error) {
    console.error('[Admin topups revenue] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
