import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { fulfillOrder } from '@/lib/fulfill-order'
import { revalidatePath } from 'next/cache'

/** Pay for an order using account balance */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const orderId = body?.orderId
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    // Get order
    const order = await payload.findByID({ collection: 'orders', id: orderId }) as any
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify payment method is balance
    if (order.payment?.method !== 'balance') {
      return NextResponse.json({ error: 'Payment method mismatch' }, { status: 400 })
    }

    // Verify order belongs to user
    const orderUserId = typeof order.user === 'object' ? order.user.id : order.user
    if (String(orderUserId) !== String(user.id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Guard: only process pending orders (prevents double-deduction)
    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Order already processed' }, { status: 409 })
    }

    const total = order.total
    if (!total || total <= 0) {
      return NextResponse.json({ error: 'Invalid order total' }, { status: 400 })
    }

    // SECURITY: Atomic-like balance deduction to prevent race conditions
    // Step 1: Get fresh balance and verify sufficiency
    const freshUser = await payload.findByID({ collection: 'users', id: user.id })
    const currentBalance = (freshUser as any).balance || 0

    if (currentBalance < total) {
      return NextResponse.json({
        error: `Số dư không đủ. Cần ${total}, hiện có ${currentBalance}`,
      }, { status: 400 })
    }

    // Step 2: Mark order as processing FIRST (prevents concurrent requests on same order)
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: { status: 'processing' } as any,
    })

    // Step 3: Re-fetch balance to minimize TOCTOU window
    const recheckUser = await payload.findByID({ collection: 'users', id: user.id })
    const recheckBalance = (recheckUser as any).balance || 0

    if (recheckBalance < total) {
      // Rollback order status
      await payload.update({
        collection: 'orders',
        id: orderId,
        data: { status: 'pending' } as any,
      })
      return NextResponse.json({
        error: `Số dư không đủ. Cần ${total}, hiện có ${recheckBalance}`,
      }, { status: 400 })
    }

    // Step 4: Deduct balance
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { balance: recheckBalance - total } as any,
    })

    // Step 5: Fulfill order — generates downloadToken, marks as paid, increments download counts
    const result = await fulfillOrder(payload, orderId, {
      paidAt: new Date().toISOString(),
    })

    try { revalidatePath('/', 'layout') } catch {}

    return NextResponse.json({
      success: true,
      newBalance: recheckBalance - total,
      orderId,
      orderNumber: result.orderNumber,
      downloadToken: result.downloadToken,
    })
  } catch (error) {
    console.error('[Balance Pay] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
