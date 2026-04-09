import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getPayloadForApi } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require either admin auth or revalidate secret
    const secret = process.env.REVALIDATE_SECRET
    const headerSecret = req.headers.get('x-revalidate-secret')

    let authorized = false

    // Check secret header
    if (secret && headerSecret === secret) {
      authorized = true
    }

    // Check admin auth
    if (!authorized) {
      try {
        const payload = await getPayloadForApi()
        const { user } = await payload.auth({ headers: req.headers })
        if (user?.role === 'admin') authorized = true
      } catch { /* auth failed */ }
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
