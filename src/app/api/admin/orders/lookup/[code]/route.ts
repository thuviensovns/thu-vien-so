import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/admin/orders/lookup/[code]
 * Admin-only. Look up an order by its orderNumber and return the order details
 * plus the customer's account profile and purchase history stats.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const payload = await getPayloadForApi()

    const { user: adminUser } = await payload.auth({ headers: req.headers })
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { code } = await params
    const orderCode = decodeURIComponent(code).trim()
    if (!orderCode) {
      return NextResponse.json({ error: 'Missing order code' }, { status: 400 })
    }

    // Find the order by orderNumber (exact match first, fall back to case-insensitive contains)
    const exact = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderCode } },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })

    let order = exact.docs[0]
    if (!order) {
      const fuzzy = await payload.find({
        collection: 'orders',
        where: { orderNumber: { contains: orderCode } },
        limit: 1,
        depth: 2,
        overrideAccess: true,
      })
      order = fuzzy.docs[0]
    }

    if (!order) {
      return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 })
    }

    const customerUser = (typeof order.user === 'object' && order.user
      ? (order.user as unknown as Record<string, unknown>)
      : null)

    // Aggregate customer stats
    let totalOrders = 0
    let totalSpent = 0
    let paidOrders = 0
    let pendingOrders = 0
    let lastOrderAt: string | null = null

    if (customerUser?.id) {
      const userOrders = await payload.find({
        collection: 'orders',
        where: { user: { equals: customerUser.id as number } },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })
      totalOrders = userOrders.totalDocs
      for (const o of userOrders.docs) {
        if (o.status === 'paid') {
          paidOrders += 1
          totalSpent += Number(o.total || 0)
        }
        if (o.status === 'pending') pendingOrders += 1
        if (!lastOrderAt || new Date(o.createdAt) > new Date(lastOrderAt)) {
          lastOrderAt = o.createdAt
        }
      }
    }

    const items = (order.items || []).map((raw: unknown) => {
      const item = raw as Record<string, unknown>
      const product = typeof item.product === 'object' && item.product
        ? (item.product as Record<string, unknown>)
        : null
      return {
        productId: (product?.id as number | string | undefined) ?? (item.product as number | string | undefined) ?? null,
        name: (item.productName as string) || (product?.name as string) || 'Sản phẩm',
        price: Number(item.price || 0),
      }
    })

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total || 0),
        status: order.status,
        method: order.payment?.method || null,
        transactionId: order.payment?.transactionId || null,
        paidAt: order.payment?.paidAt || null,
        customerEmail: order.customerEmail || customerUser?.email || null,
        customerPhone: order.customerPhone || customerUser?.phone || null,
        note: order.note || null,
        items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      customer: customerUser
        ? {
            id: customerUser.id as number,
            email: (customerUser.email as string) || null,
            displayName: (customerUser.displayName as string) || null,
            phone: (customerUser.phone as string) || null,
            role: (customerUser.role as string) || 'customer',
            balance: Number((customerUser.balance as number | string) || 0),
            createdAt: (customerUser.createdAt as string) || null,
            stats: {
              totalOrders,
              paidOrders,
              pendingOrders,
              totalSpent,
              lastOrderAt,
            },
          }
        : null,
    })
  } catch (error) {
    console.error('[Admin order lookup] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
