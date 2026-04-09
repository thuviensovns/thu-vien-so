import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { revalidatePath, revalidateTag } from 'next/cache'
import { generateDownloadUrl } from '@/lib/r2'
import { generateOrderNumber } from '@/lib/payment'

/** GET is not supported — redirect to product page or return helpful error */
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId')
  if (productId) {
    return NextResponse.redirect(new URL(`/san-pham/${productId}`, req.url))
  }
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with JSON body { productId }' },
    { status: 405 }
  )
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi(15000)

    let body: { productId?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const productId = typeof body?.productId === 'string' ? body.productId.trim().slice(0, 100) : ''
    if (!productId || /[<>"';]/.test(productId)) {
      return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })
    }

    // Find product by ID first, then by slug as fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let product: any = null
    try {
      product = await payload.findByID({
        collection: 'products',
        id: productId,
      })
    } catch {
      // findByID failed (e.g. slug passed instead of numeric ID) — try find by slug
      const bySlug = await payload.find({
        collection: 'products',
        where: { slug: { equals: productId } },
        limit: 1,
      })
      product = bySlug.docs[0] || null
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const realId = product.id
    // Safe access — pricing group can be null if product data is incomplete
    const pricing = product.pricing ?? {}
    const price = Number(pricing.price ?? 0)
    const isFree = Boolean(pricing.isFree) || price === 0

    if (!isFree && price > 0) {
      return NextResponse.json({ error: 'Product is not free' }, { status: 403 })
    }

    // Get download URL: direct link first, then R2
    let url: string | null = null
    if (product.file?.downloadUrl) {
      url = product.file.downloadUrl
    } else if (product.file?.r2Key) {
      try {
        url = await generateDownloadUrl(product.file.r2Key, 3600)
      } catch (e) {
        console.error('R2 URL generation failed:', e)
      }
    }

    // Increment download count (non-blocking)
    try {
      await payload.update({
        collection: 'products',
        id: realId,
        data: { downloadCount: (product.downloadCount || 0) + 1 },
      })
    } catch (e) {
      console.error('Download count update failed:', e)
    }

    // Revalidate pages (non-blocking)
    try {
      revalidatePath(`/san-pham/${product.slug}`, 'page')
      revalidatePath('/san-pham', 'page')
      revalidatePath('/', 'layout')
      revalidateTag('products')
    } catch {}

    // Create order record for tracking (non-blocking)
    try {
      const { user } = await payload.auth({ headers: req.headers })
      if (user) {
        await payload.create({
          collection: 'orders',
          data: {
            orderNumber: generateOrderNumber(),
            user: user.id,
            items: [{ product: realId, price: 0, productName: product.name }],
            total: 0,
            status: 'paid',
            customerEmail: user.email,
          },
        })
      }
    } catch (e) {
      console.error('Order creation failed:', e)
    }

    return NextResponse.json({
      url,
      fileName: product.file?.fileName || `${product.slug}.${product.file?.fileFormat || 'zip'}`,
      downloadCount: (product.downloadCount || 0) + 1,
      success: true,
    })
  } catch (error) {
    console.error('Free download error:', error)
    const msg = (error as Error).message || ''
    if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Database đang khởi động, vui lòng thử lại sau vài giây' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
