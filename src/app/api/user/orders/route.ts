import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'

/** GET /api/user/orders?limit=20
 *
 *  Lean replacement for Payload's /api/orders?depth=1 endpoint.
 *  Payload REST with depth=1 pulls full user, rawResponse JSONB, nested
 *  product objects per order item — often 100s of KB per response.
 *  This route returns the exact fields OrdersTab.tsx renders: order header +
 *  items[{productName, price}].
 *
 *  One round-trip, two small SELECTs (orders, then items for the returned IDs
 *  via ANY($ids)). No JSON_AGG to keep the query planner simple.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ docs: [] }, { status: 401 })
    }

    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 20, 1), 100)
    const pool = getDbPool()

    const { rows: orders } = await pool.query(
      `SELECT id, order_number, total, status, payment_method, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [user.id, limit],
    )

    if (orders.length === 0) {
      return NextResponse.json({ docs: [], totalDocs: 0 })
    }

    const orderIds = orders.map((o: Record<string, unknown>) => Number(o.id))
    const { rows: items } = await pool.query(
      `SELECT _parent_id AS order_id, product_name, price, _order AS position
       FROM orders_items
       WHERE _parent_id = ANY($1::int[])
       ORDER BY _parent_id, _order ASC`,
      [orderIds],
    )

    const itemsByOrder = new Map<number, { productName: string; price: number }[]>()
    for (const it of items as Record<string, unknown>[]) {
      const k = Number(it.order_id)
      if (!itemsByOrder.has(k)) itemsByOrder.set(k, [])
      itemsByOrder.get(k)!.push({
        productName: String(it.product_name || ''),
        price: Number(it.price || 0),
      })
    }

    const docs = orders.map((o: Record<string, unknown>) => ({
      id: String(o.id),
      orderNumber: String(o.order_number || ''),
      total: Number(o.total || 0),
      status: String(o.status || 'pending'),
      createdAt: String(o.created_at || ''),
      payment: { method: o.payment_method ? String(o.payment_method) : undefined },
      items: itemsByOrder.get(Number(o.id)) || [],
    }))

    const res = NextResponse.json({ docs, totalDocs: docs.length })
    res.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=60')
    return res
  } catch (error) {
    console.error('[user/orders] error:', error)
    const msg = (error as Error).message
    if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ docs: [], error: 'DB tạm thời không khả dụng' }, { status: 503 })
    }
    return NextResponse.json({ docs: [], error: 'Internal error' }, { status: 500 })
  }
}
