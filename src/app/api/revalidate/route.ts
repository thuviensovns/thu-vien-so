import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require either revalidate secret or admin auth cookie
    const secret = process.env.REVALIDATE_SECRET
    const headerSecret = req.headers.get('x-revalidate-secret')

    let authorized = false

    // Fast path: check secret header (no DB needed)
    if (secret && headerSecret === secret) {
      authorized = true
    }

    // Check admin auth via payload-token cookie using Payload's local API directly
    // (avoids internal HTTP fetch that can timeout on cold starts)
    if (!authorized) {
      const payloadToken = req.cookies.get('payload-token')?.value
      if (payloadToken) {
        try {
          const { getPayloadForApi } = await import('@/lib/payload')
          const payload = await getPayloadForApi()
          const { user } = await payload.auth({ headers: req.headers })
          if (user?.role === 'admin') authorized = true
        } catch { /* auth failed */ }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Revalidate all pages
    revalidatePath('/', 'layout')
    revalidatePath('/san-pham', 'layout')
    revalidatePath('/tim-kiem', 'page')
    revalidatePath('/danh-muc', 'layout')
    revalidatePath('/blog', 'layout')
    revalidatePath('/gioi-thieu', 'page')
    revalidatePath('/nap-tien', 'page')
    revalidateTag('products')
    revalidateTag('categories')
    revalidateTag('blog')
    revalidateTag('blog-posts')
    revalidateTag('site-content')
    return NextResponse.json({ revalidated: true, timestamp: Date.now() })
  } catch (error) {
    console.error('[revalidate] Error:', error)
    return NextResponse.json({ revalidated: false, error: 'Internal error' }, { status: 500 })
  }
}
