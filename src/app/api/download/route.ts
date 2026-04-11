import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { generateDownloadUrl } from '@/lib/r2'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi(15000)

    // Verify auth
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { downloadId?: string | number }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    // Payload IDs can be numbers (Postgres) or strings — accept both, coerce to string.
    const rawId = body?.downloadId
    const downloadId =
      (typeof rawId === 'string' || typeof rawId === 'number') ? String(rawId).trim().slice(0, 100) : ''
    if (!downloadId || /[<>"';]/.test(downloadId)) {
      return NextResponse.json({ error: 'Invalid downloadId' }, { status: 400 })
    }

    // Find download record
    const download = await payload.findByID({
      collection: 'downloads',
      id: downloadId,
      depth: 2,
    })

    // Verify ownership
    const downloadUserId =
      typeof download.user === 'string' ? download.user : download.user?.id
    if (downloadUserId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check download limit
    if (download.downloadCount >= download.maxDownloads) {
      return NextResponse.json(
        { error: 'Download limit reached' },
        { status: 429 },
      )
    }

    // Check expiry
    if (download.expiresAt && new Date(download.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Download expired' }, { status: 410 })
    }

    // Get product file
    const product =
      typeof download.product === 'object' ? download.product : null
    if (!product || (!product.file?.downloadUrl && !product.file?.r2Key)) {
      return NextResponse.json(
        { error: 'Product file not found' },
        { status: 404 },
      )
    }

    // Get download URL: direct link first, then R2
    let url: string
    if (product.file.downloadUrl) {
      url = product.file.downloadUrl
    } else {
      url = await generateDownloadUrl(product.file.r2Key!)
    }

    // Update download record
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const ua = req.headers.get('user-agent') || 'unknown'
    await payload.update({
      collection: 'downloads',
      id: downloadId,
      data: {
        downloadCount: download.downloadCount + 1,
        lastDownloadedAt: new Date().toISOString(),
        downloadLog: [
          ...(download.downloadLog || []),
          {
            downloadedAt: new Date().toISOString(),
            ipAddress: ip,
            userAgent: ua,
          },
        ],
      },
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Download error:', error)
    const msg = (error as Error).message
    if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Database đang khởi động, vui lòng thử lại sau vài giây' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
