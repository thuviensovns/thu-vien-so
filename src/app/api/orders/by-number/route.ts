import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

export const maxDuration = 15

/**
 * GET /api/orders/by-number?orderNumber=xxx
 * Returns downloadToken for an order (if paid). Requires auth — user can only see own orders.
 */
export async function GET(req: NextRequest) {
  try {
    const orderNumber = req.nextUrl.searchParams.get('orderNumber')
    if (!orderNumber) {
      return NextResponse.json({ error: 'Missing orderNumber' }, { status: 400 })
    }

    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await payload.find({
      collection: 'orders',
      where: {
        orderNumber: { equals: orderNumber },
        user: { equals: user.id },
      },
      limit: 1,
      depth: 0,
    })

    const order = orders.docs[0] as any
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      status: order.status,
      downloadToken: order.downloadToken || null,
      downloadExpiresAt: order.downloadExpiresAt || null,
    })
  } catch (error) {
    console.error('[Orders by-number] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
