import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    // SECURITY: Require admin authentication
    let isAdmin = false
    try {
      const { user } = await payload.auth({ headers: req.headers })
      isAdmin = user?.role === 'admin'
    } catch { /* ignore */ }

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get unread contact messages count + recent messages
    const [newMessages, recentMessages] = await Promise.all([
      payload.find({
        collection: 'contact-messages',
        where: { status: { equals: 'new' } },
        limit: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'contact-messages',
        sort: '-createdAt',
        limit: 20,
        overrideAccess: true,
      }),
    ])

    // Topup notifications — wrapped in try/catch in case readByAdmin column
    // hasn't been synced to DB yet (Payload push: true runs on first access)
    // Topup notifications: both pending (customer just created) and completed (confirmed)
    let unreadTopUpCount = 0
    let topUpDocs: Record<string, unknown>[] = []
    try {
      const unreadTopUps = await payload.find({
        collection: 'topups',
        where: {
          or: [
            { status: { equals: 'pending' } },
            {
              and: [
                { status: { equals: 'completed' } },
                { readByAdmin: { not_equals: true } },
              ],
            },
          ],
        },
        sort: '-createdAt',
        limit: 20,
        depth: 1,
        overrideAccess: true,
      })
      unreadTopUpCount = unreadTopUps.totalDocs
      topUpDocs = unreadTopUps.docs as unknown as Record<string, unknown>[]
    } catch (e) {
      console.warn('[Notifications] topup query failed, trying fallback:', (e as Error).message)
      try {
        const fallback = await payload.find({
          collection: 'topups',
          where: {
            or: [
              { status: { equals: 'pending' } },
              { status: { equals: 'completed' } },
            ],
          },
          sort: '-createdAt',
          limit: 20,
          depth: 1,
          overrideAccess: true,
        })
        unreadTopUpCount = fallback.totalDocs
        topUpDocs = fallback.docs as unknown as Record<string, unknown>[]
      } catch { /* ignore */ }
    }

    // Order notifications: pending bank-transfer + recently paid but unread by admin
    let unreadOrderCount = 0
    let orderDocs: Record<string, unknown>[] = []
    try {
      const unreadOrders = await payload.find({
        collection: 'orders',
        where: {
          or: [
            {
              and: [
                { status: { equals: 'pending' } },
                { 'payment.method': { equals: 'bank-transfer' } },
              ],
            },
            {
              and: [
                { status: { equals: 'paid' } },
                { readByAdmin: { not_equals: true } },
              ],
            },
          ],
        },
        sort: '-createdAt',
        limit: 20,
        depth: 1,
        overrideAccess: true,
      })
      unreadOrderCount = unreadOrders.totalDocs
      orderDocs = unreadOrders.docs as unknown as Record<string, unknown>[]
    } catch (e) {
      console.warn('[Notifications] order query failed, trying fallback:', (e as Error).message)
      try {
        const fallback = await payload.find({
          collection: 'orders',
          where: {
            or: [
              { status: { equals: 'pending' } },
              { status: { equals: 'paid' } },
            ],
          },
          sort: '-createdAt',
          limit: 20,
          depth: 1,
          overrideAccess: true,
        })
        unreadOrderCount = fallback.totalDocs
        orderDocs = fallback.docs as unknown as Record<string, unknown>[]
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      unreadCount: newMessages.totalDocs + unreadTopUpCount + unreadOrderCount,
      unreadMessages: newMessages.totalDocs,
      unreadTopUps: unreadTopUpCount,
      unreadOrders: unreadOrderCount,
      recent: recentMessages.docs.map((msg) => ({
        id: msg.id,
        name: msg.name,
        email: msg.email,
        subject: msg.subject,
        message: msg.message,
        status: msg.status,
        adminNote: msg.adminNote,
        ipAddress: msg.ipAddress,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
      recentTopUps: topUpDocs.map((t) => {
        const user = typeof t.user === 'object' && t.user ? (t.user as Record<string, unknown>) : null
        return {
          id: t.id,
          type: 'topup' as const,
          status: t.status as string,
          userName: (user?.displayName as string) || null,
          userEmail: (user?.email as string) || null,
          amount: t.amount,
          transferCode: t.transferCode,
          confirmedAt: t.confirmedAt,
          createdAt: t.createdAt,
        }
      }),
      recentOrders: orderDocs.map((o) => {
        const user = typeof o.user === 'object' && o.user ? (o.user as Record<string, unknown>) : null
        const payment = o.payment as Record<string, unknown> | null
        const items = Array.isArray(o.items) ? o.items as Record<string, unknown>[] : []
        return {
          id: o.id,
          type: 'order' as const,
          orderNumber: o.orderNumber as string,
          status: o.status as string,
          userName: (o.customerName as string) || (user?.displayName as string) || null,
          userEmail: (o.customerEmail as string) || (user?.email as string) || null,
          userPhone: (o.customerPhone as string) || (user?.phone as string) || null,
          total: o.total as number,
          transferCode: o.transferCode as string | null,
          paymentMethod: (payment?.method as string) || null,
          itemCount: items.length,
          itemNames: items.map((i) => (i.productName as string) || 'Sản phẩm').join(', '),
          paidAt: (payment?.paidAt as string) || null,
          createdAt: o.createdAt as string,
        }
      }),
    })
  } catch (error) {
    console.error('Notifications error:', error)
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'timeout' || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
