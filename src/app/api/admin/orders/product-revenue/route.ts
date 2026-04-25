import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'

type Row = Record<string, unknown>

const VN_TZ = 'Asia/Ho_Chi_Minh'

/** Effective sale timestamp: when payment was confirmed → falls back to row
 *  creation. AT TIME ZONE pins UTC → VN local for day-boundary alignment. */
const TS_EXPR = `(COALESCE(o.payment_paid_at, o.created_at) AT TIME ZONE '${VN_TZ}')`

/** GET: Product revenue analytics for admin /quan-ly/don-hang/doanh-thu page.
 *
 *  One round-trip returns:
 *    - products: top N products in the selected period (units sold + revenue)
 *    - daily/monthly/yearly buckets for heatmap
 *    - totals for stat cards (today/month/year/allTime)
 *
 *  Only `status='paid'` orders count — pending/failed/cancelled aren't revenue.
 *  Joins orders_items × orders so each line item gets its parent's paid_at
 *  timestamp for accurate per-period attribution.
 *
 *  Query params (all optional):
 *    - year: target year for daily/monthly buckets (default: current VN year)
 *    - month: target month (1-12) for daily bucket (default: current VN month)
 *    - day: optional day filter — when set, products list scopes to that day;
 *           else scopes to the selected month; "all" → whole period.
 *    - scope: 'day' | 'month' | 'year' | 'all' — controls products list scope
 *           (overrides day/month if conflicting). Default: 'month'.
 *    - limit: top N products (default 50, max 200)
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: VN_TZ }))
    const year = Math.min(2100, Math.max(2020, Number(req.nextUrl.searchParams.get('year')) || nowVN.getFullYear()))
    const month = Math.min(12, Math.max(1, Number(req.nextUrl.searchParams.get('month')) || (nowVN.getMonth() + 1)))
    const dayParam = req.nextUrl.searchParams.get('day')
    const day = dayParam && dayParam !== 'all' ? Math.min(31, Math.max(1, Number(dayParam))) : null
    const scopeParam = req.nextUrl.searchParams.get('scope') || (day ? 'day' : 'month')
    const scope = (['day', 'month', 'year', 'all'] as const).includes(scopeParam as never)
      ? (scopeParam as 'day' | 'month' | 'year' | 'all') : 'month'
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 50))

    // Build the products-list scope clause based on selector
    const scopeClauses: string[] = []
    const scopeParams: unknown[] = []
    let pIdx = 1
    if (scope === 'year' || scope === 'month' || scope === 'day') {
      scopeClauses.push(`EXTRACT(YEAR FROM ${TS_EXPR}) = $${pIdx++}`)
      scopeParams.push(year)
    }
    if (scope === 'month' || scope === 'day') {
      scopeClauses.push(`EXTRACT(MONTH FROM ${TS_EXPR}) = $${pIdx++}`)
      scopeParams.push(month)
    }
    if (scope === 'day' && day) {
      scopeClauses.push(`EXTRACT(DAY FROM ${TS_EXPR}) = $${pIdx++}`)
      scopeParams.push(day)
    }
    const productScopeWhere = scopeClauses.length ? `AND ${scopeClauses.join(' AND ')}` : ''

    const baseWhere = `o.status = 'paid'`
    const pool = getDbPool()

    const [
      { rows: productRows },
      { rows: dailyRows },
      { rows: monthlyRows },
      { rows: yearlyRows },
      { rows: totalsRows },
      { rows: todayRows },
      { rows: monthTotalsRows },
      { rows: yearTotalsRows },
    ] = await Promise.all([
      // Top products in selected scope
      pool.query<Row>(
        `SELECT oi.product_id,
                COALESCE(MAX(oi.product_name), 'Sản phẩm #' || oi.product_id::text) AS product_name,
                COUNT(*)::int AS units,
                COALESCE(SUM(oi.price), 0)::bigint AS revenue
         FROM orders_items oi
         JOIN orders o ON o.id = oi._parent_id
         WHERE ${baseWhere}
           ${productScopeWhere}
         GROUP BY oi.product_id
         ORDER BY revenue DESC, units DESC
         LIMIT ${limit}`,
        scopeParams,
      ),
      // Daily revenue (orders aggregate, not per-product) for heatmap
      pool.query<Row>(
        `SELECT EXTRACT(DAY FROM ${TS_EXPR})::int AS day,
                COALESCE(SUM(oi.price), 0)::bigint AS revenue,
                COUNT(*)::int AS units
         FROM orders_items oi
         JOIN orders o ON o.id = oi._parent_id
         WHERE ${baseWhere}
           AND EXTRACT(YEAR FROM ${TS_EXPR}) = $1
           AND EXTRACT(MONTH FROM ${TS_EXPR}) = $2
         GROUP BY day
         ORDER BY day`,
        [year, month],
      ),
      // Monthly buckets for selected year
      pool.query<Row>(
        `SELECT EXTRACT(MONTH FROM ${TS_EXPR})::int AS month,
                COALESCE(SUM(oi.price), 0)::bigint AS revenue,
                COUNT(*)::int AS units
         FROM orders_items oi
         JOIN orders o ON o.id = oi._parent_id
         WHERE ${baseWhere}
           AND EXTRACT(YEAR FROM ${TS_EXPR}) = $1
         GROUP BY month
         ORDER BY month`,
        [year],
      ),
      // Yearly buckets
      pool.query<Row>(
        `SELECT EXTRACT(YEAR FROM ${TS_EXPR})::int AS year,
                COALESCE(SUM(oi.price), 0)::bigint AS revenue,
                COUNT(*)::int AS units
         FROM orders_items oi
         JOIN orders o ON o.id = oi._parent_id
         WHERE ${baseWhere}
         GROUP BY year
         ORDER BY year`,
      ),
      // All-time totals
      pool.query<Row>(
        `SELECT COALESCE(SUM(oi.price), 0)::bigint AS revenue,
                COUNT(*)::int AS units,
                COUNT(DISTINCT oi.product_id)::int AS distinct_products
         FROM orders_items oi
         JOIN orders o ON o.id = oi._parent_id
         WHERE ${baseWhere}`,
      ),
      // Today's totals
      pool.query<Row>(
        `SELECT COALESCE(SUM(oi.price), 0)::bigint AS revenue,
                COUNT(*)::int AS units,
                COUNT(DISTINCT oi.product_id)::int AS distinct_products
         FROM orders_items oi
         JOIN orders o ON o.id = oi._parent_id
         WHERE ${baseWhere}
           AND DATE(${TS_EXPR}) = (CURRENT_TIMESTAMP AT TIME ZONE '${VN_TZ}')::date`,
      ),
      // Selected month totals
      pool.query<Row>(
        `SELECT COALESCE(SUM(oi.price), 0)::bigint AS revenue,
                COUNT(*)::int AS units,
                COUNT(DISTINCT oi.product_id)::int AS distinct_products
         FROM orders_items oi
         JOIN orders o ON o.id = oi._parent_id
         WHERE ${baseWhere}
           AND EXTRACT(YEAR FROM ${TS_EXPR}) = $1
           AND EXTRACT(MONTH FROM ${TS_EXPR}) = $2`,
        [year, month],
      ),
      // Selected year totals
      pool.query<Row>(
        `SELECT COALESCE(SUM(oi.price), 0)::bigint AS revenue,
                COUNT(*)::int AS units,
                COUNT(DISTINCT oi.product_id)::int AS distinct_products
         FROM orders_items oi
         JOIN orders o ON o.id = oi._parent_id
         WHERE ${baseWhere}
           AND EXTRACT(YEAR FROM ${TS_EXPR}) = $1`,
        [year],
      ),
    ])

    // Dense daily array for heatmap rendering
    const daysInMonth = new Date(year, month, 0).getDate()
    const dailyMap = new Map<number, { revenue: number; units: number }>()
    for (const r of dailyRows) {
      dailyMap.set(Number(r.day), { revenue: Number(r.revenue || 0), units: Number(r.units || 0) })
    }
    const daily = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const cell = dailyMap.get(d)
      return { day: d, revenue: cell?.revenue || 0, units: cell?.units || 0 }
    })

    // Dense monthly array
    const monthlyMap = new Map<number, { revenue: number; units: number }>()
    for (const r of monthlyRows) {
      monthlyMap.set(Number(r.month), { revenue: Number(r.revenue || 0), units: Number(r.units || 0) })
    }
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const cell = monthlyMap.get(m)
      return { month: m, revenue: cell?.revenue || 0, units: cell?.units || 0 }
    })

    // Yearly: ensure current year has a slot even if empty
    const yearlyMap = new Map<number, { revenue: number; units: number }>()
    for (const r of yearlyRows) {
      yearlyMap.set(Number(r.year), { revenue: Number(r.revenue || 0), units: Number(r.units || 0) })
    }
    const currentYear = nowVN.getFullYear()
    if (!yearlyMap.has(currentYear)) yearlyMap.set(currentYear, { revenue: 0, units: 0 })
    const yearly = Array.from(yearlyMap.entries())
      .map(([y, v]) => ({ year: y, revenue: v.revenue, units: v.units }))
      .sort((a, b) => a.year - b.year)

    const products = productRows.map((r: Row) => ({
      productId: Number(r.product_id),
      productName: String(r.product_name || ''),
      units: Number(r.units || 0),
      revenue: Number(r.revenue || 0),
    }))

    const res = NextResponse.json({
      year,
      month,
      day,
      scope,
      products,
      daily,
      monthly,
      yearly,
      totals: {
        today: {
          revenue: Number(todayRows[0]?.revenue || 0),
          units: Number(todayRows[0]?.units || 0),
          distinctProducts: Number(todayRows[0]?.distinct_products || 0),
        },
        month: {
          revenue: Number(monthTotalsRows[0]?.revenue || 0),
          units: Number(monthTotalsRows[0]?.units || 0),
          distinctProducts: Number(monthTotalsRows[0]?.distinct_products || 0),
        },
        year: {
          revenue: Number(yearTotalsRows[0]?.revenue || 0),
          units: Number(yearTotalsRows[0]?.units || 0),
          distinctProducts: Number(yearTotalsRows[0]?.distinct_products || 0),
        },
        allTime: {
          revenue: Number(totalsRows[0]?.revenue || 0),
          units: Number(totalsRows[0]?.units || 0),
          distinctProducts: Number(totalsRows[0]?.distinct_products || 0),
        },
      },
    })
    res.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
    return res
  } catch (error) {
    console.error('[Admin orders product-revenue] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
