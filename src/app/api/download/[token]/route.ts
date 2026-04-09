import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { generateDownloadUrl } from '@/lib/r2'
import type { Order, OrderItem, Product } from '@/types/payload-types'

export const maxDuration = 30

/**
 * GET /api/download/[token]?productId=xxx
 *
 * Token-based download — no auth required. The token IS the authorization.
 * Returns JSON with download URL (R2 signed or direct link).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const productId = req.nextUrl.searchParams.get('productId')

    if (!token || token.length > 100) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    const payload = await getPayloadForApi()

    // Find order by downloadToken
    const orders = await payload.find({
      collection: 'orders',
      where: { downloadToken: { equals: token } },
      limit: 1,
      depth: 1, // resolve product relationships
    })

    const order = orders.docs[0] as Order
    if (!order) {
      return NextResponse.json({ error: 'Token không hợp lệ hoặc đã hết hạn' }, { status: 404 })
    }

    // Check expiry
    if (order.downloadExpiresAt && new Date(order.downloadExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Link tải đã hết hạn (72 giờ)' }, { status: 410 })
    }

    // Check order is paid
    if (order.status !== 'paid') {
      return NextResponse.json({ error: 'Đơn hàng chưa được thanh toán' }, { status: 402 })
    }

    // If no productId specified, return list of downloadable products
    if (!productId) {
      const items = (order.items || []).map((item: OrderItem) => {
        const product = typeof item.product === 'object' ? item.product as Product : null
        const file = product?.file || {}
        return {
          productId: product ? product.id : item.product,
          name: item.productName || product?.name || 'Unknown',
          hasFile: !!(file.r2Key || file.downloadUrl),
          fileName: file.fileName || null,
          fileSize: file.fileSize || null,
          fileFormat: file.fileFormat || null,
        }
      })
      return NextResponse.json({
        orderNumber: order.orderNumber,
        expiresAt: order.downloadExpiresAt,
        items,
      })
    }

    // Find the product in order items
    const orderItem = (order.items || []).find((item: OrderItem) => {
      const pid = typeof item.product === 'object' ? String((item.product as Product).id) : String(item.product)
      return pid === String(productId)
    })

    if (!orderItem) {
      return NextResponse.json({ error: 'Sản phẩm không có trong đơn hàng' }, { status: 404 })
    }

    // Get product file info
    const product = typeof orderItem.product === 'object' ? orderItem.product : null
    if (!product) {
      // Product not resolved, fetch it
      const fetched = await payload.findByID({ collection: 'products', id: productId, depth: 0 }) as Product
      return generateFileResponse(fetched)
    }

    return generateFileResponse(product as Product)
  } catch (error) {
    console.error('[Download Token] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generateFileResponse(product: Product) {
  const file = product?.file || {}
  const fileName = file.fileName || `${product?.slug || 'product'}.zip`

  // Priority 1: R2 signed URL
  if (file.r2Key) {
    try {
      const url = await generateDownloadUrl(file.r2Key, 3600) // 1 hour expiry
      return NextResponse.json({ url, fileName, source: 'r2' })
    } catch (e) {
      console.error('[Download Token] R2 error:', e)
      // Fall through to direct URL
    }
  }

  // Priority 2: Direct download URL (Google Drive, Mediafire, etc.)
  if (file.downloadUrl) {
    return NextResponse.json({ url: file.downloadUrl, fileName, source: 'direct' })
  }

  return NextResponse.json({
    error: 'Sản phẩm chưa có file tải. Vui lòng liên hệ hỗ trợ.',
  }, { status: 404 })
}
