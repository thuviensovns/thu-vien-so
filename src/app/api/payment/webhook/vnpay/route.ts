import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { revalidatePath, revalidateTag } from 'next/cache'
import { verifyVNPaySignature } from '@/lib/payment'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const params: Record<string, string> = {}

    req.nextUrl.searchParams.forEach((value, key) => {
      // Only accept vnp_ prefixed params + limit value length
      if (key.startsWith('vnp_') && value.length <= 500) {
        params[key] = value
      }
    })

    // Verify required VNPay params exist
    if (!params.vnp_SecureHash || !params.vnp_TxnRef || !params.vnp_ResponseCode) {
      return NextResponse.json({ RspCode: '99', Message: 'Missing required params' })
    }

    // Verify signature
    if (!verifyVNPaySignature(params)) {
      console.warn('VNPay signature verification failed for TxnRef:', params.vnp_TxnRef)
      return NextResponse.json({ RspCode: '97', Message: 'Invalid Signature' })
    }

    const responseCode = params.vnp_ResponseCode
    const orderNumber = params.vnp_TxnRef.slice(0, 50)
    const transactionId = params.vnp_TransactionNo?.slice(0, 50) || ''

    // Validate orderNumber format
    if (!/^MUS-[A-Z0-9]+-[A-Z0-9]+$/.test(orderNumber)) {
      return NextResponse.json({ RspCode: '01', Message: 'Invalid order reference' })
    }

    // Find order
    const orders = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
    })

    const order = orders.docs[0]
    if (!order) {
      return NextResponse.json({ RspCode: '01', Message: 'Order not found' })
    }

    // Idempotency: already processed
    if (order.status === 'paid') {
      return NextResponse.json({ RspCode: '00', Message: 'Already confirmed' })
    }

    // Check payment success
    if (responseCode !== '00') {
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: {
          status: 'failed',
          payment: {
            ...order.payment,
            transactionId,
            rawResponse: params,
          },
        },
      })
      return NextResponse.json({ RspCode: '00', Message: 'Confirm Success' })
    }

    // Payment success — update order
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        status: 'paid',
        payment: {
          ...order.payment,
          transactionId,
          paidAt: new Date().toISOString(),
          rawResponse: params,
        },
      },
    })

    // Create download records for each item
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 72)

    for (const item of order.items) {
      const productId =
        typeof item.product === 'string' ? item.product : item.product?.id
      if (!productId) continue

      await payload.create({
        collection: 'downloads',
        data: {
          user: typeof order.user === 'string' ? order.user : order.user.id,
          order: order.id,
          product: productId,
          downloadCount: 0,
          maxDownloads: 5,
          expiresAt: expiresAt.toISOString(),
        },
      })

      // Increment product download count
      const product = await payload.findByID({
        collection: 'products',
        id: productId,
      })
      await payload.update({
        collection: 'products',
        id: productId,
        data: { downloadCount: (product.downloadCount || 0) + 1 },
      })
    }

    // Revalidate pages so stats update
    try {
      revalidatePath('/', 'layout')
      revalidatePath('/san-pham', 'page')
      revalidateTag('products')
    } catch {}

    return NextResponse.json({ RspCode: '00', Message: 'Confirm Success' })
  } catch (error) {
    console.error('VNPay webhook error:', error)
    return NextResponse.json({ RspCode: '99', Message: 'Unknown error' })
  }
}
