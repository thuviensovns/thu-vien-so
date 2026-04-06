import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { revalidatePath, revalidateTag } from 'next/cache'
import { generateDownloadUrl } from '@/lib/r2'
import { generateOrderNumber } from '@/lib/payment'

/** GET is not supported — redirect to product page or return helpful error */
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId')
  if (productId) {
    // Redirect to product detail page instead of showing 405
    return NextResponse.redirect(new URL(`/san-pham/${productId}`, req.url))
  }
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with JSON body { productId }' },
    { status: 405 }
  )
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const productId = typeof body?.productId === 'string' ? body.productId.trim().slice(0, 100) : ''
    if (!productId || /[<>"';]/.test(productId)) {
      return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })
    }

    // Verify product is free
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
    })

    if (!product.pricing.isFree && product.pricing.price > 0) {
      return NextResponse.json(
        { error: 'Product is not free' },
        { status: 403 },
      )
    }

    // Always increment download count for free products
    const newCount = (product.downloadCount || 0) + 1
    await payload.update({
      collection: 'products',
      id: productId,
      data: { downloadCount: newCount },
    })

    // Revalidate pages so stats update immediately
    try {
      revalidatePath(`/san-pham/${product.slug}`, 'page')
      revalidatePath('/san-pham', 'page')
      revalidatePath('/', 'layout')
      revalidatePath('/gioi-thieu', 'page')
      revalidatePath('/danh-muc', 'page')
      revalidateTag('products')
    } catch {}

    // Optionally create order record for tracking
    const { user } = await payload.auth({ headers: req.headers })
    if (user) {
      const orderNumber = generateOrderNumber()
      await payload.create({
        collection: 'orders',
        data: {
          orderNumber,
          user: user.id,
          items: [
            {
              product: productId,
              price: 0,
              productName: product.name,
            },
          ],
          total: 0,
          status: 'paid',
          customerEmail: user.email,
        },
      })
    }

    // Generate R2 download URL if file exists
    let url: string | null = null
    if (product.file?.r2Key) {
      try {
        url = await generateDownloadUrl(product.file.r2Key, 3600)
      } catch {}
    }

    return NextResponse.json({ url, downloadCount: newCount, success: true })
  } catch (error) {
    console.error('Free download error:', error)
    const msg = (error as Error).message
    if (msg === 'timeout' || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
