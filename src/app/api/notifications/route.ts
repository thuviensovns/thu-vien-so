import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'

/** GET /api/notifications
 *
 *  Admin notification badge + recent-activity dropdown. Polled by the admin
 *  layout roughly once a minute across every open admin tab, so we keep the
 *  work tiny: 5 concurrent, indexed, *small* SELECTs instead of 5 Payload
 *  `find({ depth:1 })` calls (each of which hydrates nested relations).
 *
 *  Composite indexes used (Phase 9):
 *   - orders(status, created_at DESC)
 *   - topups(status, created_at DESC)
 *
 *  Auth is still Payload-based so cookie/session semantics don't diverge.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

type Row = Record<string, unknown>

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    let isAdmin = false
    try {
      const { user } = await payload.auth({ headers: req.headers })
      isAdmin = user?.role === 'admin'
    } catch { /* ignore */ }

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const pool = getDbPool()

    const [
      { rows: newMsgCountRows },
      { rows: recentMsgs },
      { rows: topUps },
      { rows: orders },
    ] = await Promise.all([
      pool.query<Row>(
        `SELECT COUNT(*)::int AS c FROM contact_messages WHERE status = 'new'`,
      ),
      pool.query<Row>(
        `SELECT id, name, email, subject, message, status, admin_note, ip_address, created_at, updated_at
         FROM contact_messages
         ORDER BY created_at DESC
         LIMIT 20`,
      ),
      pool.query<Row>(
        `SELECT t.id, t.status, t.amount, t.transfer_code, t.confirmed_at, t.created_at,
                u.display_name, u.email
         FROM topups t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.status = 'pending'
            OR (t.status = 'completed' AND t.read_by_admin IS NOT TRUE)
         ORDER BY t.created_at DESC
         LIMIT 20`,
      ),
      pool.query<Row>(
        `SELECT o.id, o.order_number, o.status, o.total, o.transfer_code,
                o.payment_method, o.payment_paid_at, o.customer_name, o.customer_email,
                o.customer_phone, o.created_at,
                u.display_name AS u_name, u.email AS u_email, u.phone AS u_phone,
                (SELECT COUNT(*)::int FROM orders_items WHERE _parent_id = o.id) AS item_count,
                (SELECT STRING_AGG(COALESCE(product_name, 'Sản phẩm'), ', ' ORDER BY _order)
                   FROM orders_items WHERE _parent_id = o.id) AS item_names
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         WHERE (o.status = 'pending' AND o.payment_method = 'bank-transfer')
            OR (o.status = 'paid' AND o.read_by_admin IS NOT TRUE)
         ORDER BY o.created_at DESC
         LIMIT 20`,
      ),
    ])

    const unreadMessages = Number(newMsgCountRows[0]?.c || 0)
    const unreadTopUps = topUps.length
    const unreadOrders = orders.length

    const res = NextResponse.json({
      unreadCount: unreadMessages + unreadTopUps + unreadOrders,
      unreadMessages,
      unreadTopUps,
      unreadOrders,
      recent: recentMsgs.map((m: Row) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        subject: m.subject,
        message: m.message,
        status: m.status,
        adminNote: m.admin_note,
        ipAddress: m.ip_address,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      })),
      recentTopUps: topUps.map((t: Row) => ({
        id: t.id,
        type: 'topup' as const,
        status: t.status,
        userName: (t.display_name as string) || null,
        userEmail: (t.email as string) || null,
        amount: t.amount,
        transferCode: t.transfer_code,
        confirmedAt: t.confirmed_at,
        createdAt: t.created_at,
      })),
      recentOrders: orders.map((o: Row) => ({
        id: o.id,
        type: 'order' as const,
        orderNumber: o.order_number,
        status: o.status,
        userName: (o.customer_name as string) || (o.u_name as string) || null,
        userEmail: (o.customer_email as string) || (o.u_email as string) || null,
        userPhone: (o.customer_phone as string) || (o.u_phone as string) || null,
        total: o.total,
        transferCode: o.transfer_code || null,
        paymentMethod: (o.payment_method as string) || null,
        itemCount: Number(o.item_count || 0),
        itemNames: (o.item_names as string) || '',
        paidAt: (o.payment_paid_at as string) || null,
        createdAt: o.created_at,
      })),
    })
    // Short private cache covers the case of multiple admin tabs polling in
    // quick succession; CDN can't cache (Forbidden for non-admins) but browser
    // reuse is safe for the same logged-in session.
    res.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=15')
    return res
  } catch (error) {
    console.error('Notifications error:', error)
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'timeout' || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
