import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'

type Row = Record<string, unknown>

/** GET: List orders for admin management page.
 *
 *  Uses raw SQL instead of Payload `find({ depth:1 })`. Items are fetched in a
 *  single follow-up query keyed by the page of order ids (N+1 avoided).
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const search = (req.nextUrl.searchParams.get('search') || '').trim()
    const status = req.nextUrl.searchParams.get('status') || ''
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1)
    const sort = req.nextUrl.searchParams.get('sort') || '-createdAt'
    const limit = 20
    const offset = (page - 1) * limit

    const orderBy = sort === 'createdAt'
      ? 'o.created_at ASC'
      : sort === 'total'
        ? 'o.total DESC'
        : sort === '-total'
          ? 'o.total ASC'
          : 'o.created_at DESC'

    const conditions: string[] = []
    const params: unknown[] = []
    let i = 1

    if (search) {
      const like = `%${search}%`
      conditions.push(`(o.order_number ILIKE $${i} OR o.customer_email ILIKE $${i})`)
      params.push(like)
      i += 1
    }
    if (status && status !== 'all') {
      conditions.push(`o.status = $${i}`)
      params.push(status)
      i += 1
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const pool = getDbPool()

    const [{ rows: countRows }, { rows: orders }] = await Promise.all([
      pool.query<Row>(`SELECT COUNT(*)::int AS c FROM orders o ${whereSql}`, params),
      pool.query<Row>(
        `SELECT o.id, o.order_number, o.total, o.status, o.payment_method,
                o.customer_email, o.created_at,
                u.email AS u_email
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
    ])

    const totalDocs = Number(countRows[0]?.c || 0)
    const totalPages = Math.max(1, Math.ceil(totalDocs / limit))

    let itemsByOrder = new Map<number, { name: string; price: number }[]>()
    if (orders.length > 0) {
      const orderIds = orders.map((o: Row) => Number(o.id))
      const { rows: items } = await pool.query<Row>(
        `SELECT _parent_id AS order_id, product_name, price, _order
         FROM orders_items
         WHERE _parent_id = ANY($1::int[])
         ORDER BY _parent_id, _order ASC`,
        [orderIds],
      )
      itemsByOrder = new Map()
      for (const it of items) {
        const k = Number(it.order_id)
        if (!itemsByOrder.has(k)) itemsByOrder.set(k, [])
        itemsByOrder.get(k)!.push({
          name: String(it.product_name || 'Sản phẩm'),
          price: Number(it.price || 0),
        })
      }
    }

    const res = NextResponse.json({
      docs: orders.map((o: Row) => ({
        id: o.id,
        orderNumber: o.order_number,
        email: (o.customer_email as string) || (o.u_email as string) || 'Unknown',
        total: Number(o.total || 0),
        status: o.status,
        method: (o.payment_method as string) || 'balance',
        items: itemsByOrder.get(Number(o.id)) || [],
        createdAt: o.created_at,
      })),
      totalDocs,
      totalPages,
      page,
    })
    res.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=15')
    return res
  } catch (error) {
    console.error('[Admin orders] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** PATCH: Update order status */
export async function PATCH(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { id?: number; status?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (!body.id || !body.status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
    }

    const validStatuses = ['pending', 'paid', 'failed', 'refunded']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { status: body.status }
    if (body.status === 'paid') {
      data['payment.paidAt'] = new Date().toISOString()
    }

    await payload.update({
      collection: 'orders',
      id: body.id,
      data,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin orders] PATCH error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
