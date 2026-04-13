import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { createVNPayUrl, generateOrderNumber } from '@/lib/payment'
import { getUserTransferCode } from '@/lib/config'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    // Verify auth
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { paymentMethod?: string; items?: Array<{ productId: string }>; customerEmail?: string; customerPhone?: string; customerName?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Validate paymentMethod
    const allowedMethods = ['vnpay', 'bank-transfer', 'momo', 'balance']
    const paymentMethod = typeof body?.paymentMethod === 'string' && allowedMethods.includes(body.paymentMethod)
      ? body.paymentMethod
      : 'vnpay'

    // Validate items array
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

    // Verify prices from database (prevent price tampering)
    const orderItems = []
    let total = 0

    for (const item of items) {
      const product = await payload.findByID({
        collection: 'products',
        id: item.productId,
      })

      if (!product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 400 },
        )
      }

      const price = product.pricing.price
      total += price
      orderItems.push({
        product: product.id,
        price,
        productName: product.name,
      })
    }

    // Cancel any existing pending bank-transfer orders for this user
    // (user's fixed transfer code means only one pending order at a time)
    if (paymentMethod === 'bank-transfer') {
      const oldOrders = await payload.find({
        collection: 'orders',
        where: {
          user: { equals: user.id },
          status: { equals: 'pending' },
          'payment.method': { equals: 'bank-transfer' },
        },
        limit: 10,
        depth: 0,
      })
      for (const old of oldOrders.docs) {
        await payload.update({
          collection: 'orders',
          id: old.id,
          data: { status: 'failed' },
        })
      }
    }

    // Create order with user's fixed transfer code
    const orderNumber = generateOrderNumber()
    const transferCode = getUserTransferCode(user.id)
    // Sanitize customer info from form
    const customerName = typeof body?.customerName === 'string' ? body.customerName.trim().slice(0, 100) : ''
    const customerPhone = typeof body?.customerPhone === 'string' ? body.customerPhone.trim().slice(0, 20) : ''
    const customerEmail = typeof body?.customerEmail === 'string' && body.customerEmail.includes('@')
      ? body.customerEmail.trim().slice(0, 100)
      : user.email

    const order = await payload.create({
      collection: 'orders',
      data: {
        orderNumber,
        transferCode,
        user: user.id,
        items: orderItems,
        total,
        status: 'pending',
        payment: {
          method: paymentMethod,
        },
        customerName: customerName || (user as Record<string, unknown>).displayName as string || '',
        customerEmail,
        customerPhone,
      },
    })

    // For bank-transfer, return order info (user scans QR, Sepay webhook confirms later)
    if (paymentMethod === 'bank-transfer') {
      return NextResponse.json({ orderId: order.id, orderNumber, transferCode, status: 'pending' })
    }

    // Generate payment URL
    if (paymentMethod === 'vnpay') {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thuvienso.top'
      const paymentUrl = createVNPayUrl({
        orderId: orderNumber,
        amount: total,
        orderInfo: `Thanh toan don hang ${orderNumber}`,
        returnUrl: `${siteUrl}/thanh-toan/ket-qua`,
        ipAddr: req.headers.get('x-forwarded-for') || '127.0.0.1',
      })

      return NextResponse.json({ paymentUrl, orderId: order.id, orderNumber })
    }

    return NextResponse.json({ orderId: order.id, orderNumber })
  } catch (error) {
    console.error('Create order error:', error)
    const msg = (error as Error).message
    if (msg === 'timeout' || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
