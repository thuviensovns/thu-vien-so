import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { generateOrderNumber } from '@/lib/payment'
import { getUserTransferCode } from '@/lib/config'
import { fulfillOrder } from '@/lib/fulfill-order'
import { revalidatePath } from 'next/cache'
import type { User } from '@/types/payload-types'

export const maxDuration = 30

/**
 * Combined create-order + pay-with-balance in a single round-trip.
 *
 * Replaces the previous two-call `create-order` → `pay-with-balance` flow used
 * by `instantBuyWithBalance`: one auth pass, one DB handshake, perceptibly
 * faster loading toast on "Mua ngay" clicks when the user's balance covers it.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { items?: Array<{ productId: string }> }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const items = body?.items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }
    if (items.length > 50) {
      return NextResponse.json({ error: 'Too many items' }, { status: 400 })
    }
    for (const item of items) {
      const pid = typeof item?.productId === 'string' ? item.productId.trim() : ''
      if (!pid || pid.length > 100 || /[<>"';]/.test(pid)) {
        return NextResponse.json({ error: 'Invalid productId in items' }, { status: 400 })
      }
    }

    // Verify prices from DB
    const orderItems = []
    let total = 0
    for (const item of items) {
      const product = await payload.findByID({
        collection: 'products',
        id: item.productId,
      })
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 400 })
      }
      const price = product.pricing.price
      total += price
      orderItems.push({ product: product.id, price, productName: product.name })
    }

    if (total <= 0) {
      return NextResponse.json({ error: 'Invalid order total' }, { status: 400 })
    }

    // Pre-check balance before creating any records
    const freshUser = await payload.findByID({ collection: 'users', id: user.id }) as User
    const currentBalance = freshUser.balance || 0
    if (currentBalance < total) {
      return NextResponse.json({
        error: `Số dư không đủ. Cần ${total}, hiện có ${currentBalance}`,
      }, { status: 400 })
    }

    // Create order directly in 'processing' so a concurrent balance-pay flow
    // on the same user can't double-deduct against this order row.
    const orderNumber = generateOrderNumber()
    const transferCode = getUserTransferCode(user.id)

    const orderData: Record<string, unknown> = {
      orderNumber,
      user: user.id,
      items: orderItems,
      total,
      status: 'processing',
      payment: { method: 'balance' },
      customerEmail: user.email,
      transferCode,
      customerName: (user as Record<string, unknown>).displayName || '',
      customerPhone: '',
    }

    let order
    try {
      order = await payload.create({ collection: 'orders', data: orderData })
    } catch (createErr) {
      const msg = (createErr as Error).message || ''
      if (/column|field|transfer|customer|read_by_admin/i.test(msg)) {
        delete orderData.transferCode
        delete orderData.customerName
        delete orderData.customerPhone
        delete orderData.customerEmail
        order = await payload.create({ collection: 'orders', data: orderData })
      } else {
        throw createErr
      }
    }

    // Re-check balance right before deduction (TOCTOU window)
    const recheckUser = await payload.findByID({ collection: 'users', id: user.id }) as User
    const recheckBalance = recheckUser.balance || 0
    if (recheckBalance < total) {
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: { status: 'failed' },
        overrideAccess: true,
      })
      return NextResponse.json({
        error: `Số dư không đủ. Cần ${total}, hiện có ${recheckBalance}`,
      }, { status: 400 })
    }

    // Deduct balance
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { balance: recheckBalance - total },
      overrideAccess: true,
    })

    // Fulfill (generates download token, marks paid)
    let result
    try {
      result = await fulfillOrder(payload, order.id, {
        paidAt: new Date().toISOString(),
      })
    } catch (fulfillErr) {
      console.error('[Instant Buy] fulfillOrder failed — refunding balance:', fulfillErr)
      try {
        const refundUser = await payload.findByID({ collection: 'users', id: user.id }) as User
        await payload.update({
          collection: 'users',
          id: user.id,
          data: { balance: (refundUser.balance || 0) + total },
          overrideAccess: true,
        })
        await payload.update({
          collection: 'orders',
          id: order.id,
          data: { status: 'failed' },
          overrideAccess: true,
        })
      } catch (refundErr) {
        console.error('[Instant Buy] CRITICAL: refund also failed:', refundErr)
      }
      return NextResponse.json({
        error: 'Không thể hoàn tất đơn hàng. Số dư đã được hoàn lại, vui lòng thử lại.',
      }, { status: 500 })
    }

    try { revalidatePath('/', 'layout') } catch {}

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: result.orderNumber,
      downloadToken: result.downloadToken,
      newBalance: recheckBalance - total,
    })
  } catch (error) {
    console.error('[Instant Buy] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
