import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { generateDownloadUrl } from '@/lib/r2'

/** GET /api/video-stream?slug={productSlug}
 *  Redirects to a short-lived signed R2 URL for the product's demo video.
 *  Public endpoint — anyone viewing the product page can play the video.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  try {
    const payload = await getPayloadForApi()
    const result = await payload.find({
      collection: 'products',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    const product = result.docs[0] as { video?: { r2Key?: string | null } } | undefined
    const r2Key = product?.video?.r2Key
    if (!r2Key) return NextResponse.json({ error: 'No video for this product' }, { status: 404 })

    // 1-hour signed URL — enough for a viewing session, forces fresh signing if
    // the page is kept open overnight.
    const signedUrl = await generateDownloadUrl(r2Key, 3600)
    return NextResponse.redirect(signedUrl, 307)
  } catch (err) {
    console.error('[Video stream] Error:', err)
    return NextResponse.json({ error: 'Failed to resolve video' }, { status: 500 })
  }
}
