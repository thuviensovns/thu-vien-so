import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { generateDownloadUrl } from '@/lib/r2'

/**
 * Auto-download endpoint called after successful payment.
 * Finds the download record for the product+order and returns a signed URL.
 * Falls back gracefully when DB is unavailable.
 */
export async function POST(req: NextRequest) {
  try {
    let body: { productId?: string; orderNumber?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const productId = typeof body?.productId === 'string' ? body.productId.trim().slice(0, 100) : ''
    const orderNumber = typeof body?.orderNumber === 'string' ? body.orderNumber.trim().slice(0, 50) : undefined

    if (!productId || /[<>"';]/.test(productId)) {
      return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })
    }

    const payload = await getPayloadForApi(15000)

    // SECURITY: Require authenticated user
    let user: Record<string, unknown> | null = null
    try {
      const auth = await payload.auth({ headers: req.headers })
      user = auth.user
    } catch { /* auth failed */ }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find download record for this product (always filtered by user)
    const downloads = await payload.find({
      collection: 'downloads',
      where: {
        product: { equals: productId },
        user: { equals: user.id },
      },
      sort: '-createdAt',
      limit: 1,
      depth: 2,
    })

    const download = downloads.docs[0]
    if (!download) {
      return NextResponse.json({ error: 'Download not found' }, { status: 404 })
    }

    // Check limits
    if (download.downloadCount >= download.maxDownloads) {
      return NextResponse.json({ error: 'Download limit reached' }, { status: 429 })
    }

    if (download.expiresAt && new Date(download.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Download expired' }, { status: 410 })
    }

    // Get product file
    const product = typeof download.product === 'object' ? download.product : null
    if (!product?.file?.downloadUrl && !product?.file?.r2Key) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get download URL: direct link first, then R2
    let url: string
    if (product.file.downloadUrl) {
      url = product.file.downloadUrl
    } else {
      url = await generateDownloadUrl(product.file.r2Key!)
    }

    // Determine filename
    const ext = product.file.fileFormat || 'zip'
    const fileName = product.file.fileName || `${product.slug || productId}.${ext}`

    // Increment download count
    await payload.update({
      collection: 'downloads',
      id: download.id,
      data: {
        downloadCount: download.downloadCount + 1,
        lastDownloadedAt: new Date().toISOString(),
      },
    })

    return NextResponse.json({ url, fileName })
  } catch (error) {
    console.error('Auto-download error:', error)
    // Return 404 so client falls back to demo download
    return NextResponse.json({ error: 'Service unavailable' }, { status: 404 })
  }
}
