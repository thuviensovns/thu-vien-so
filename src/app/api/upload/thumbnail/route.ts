import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { uploadToR2, generateDownloadUrl } from '@/lib/r2'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** POST: Upload a product thumbnail to R2, return a public URL */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const productSlug = formData.get('productSlug') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WebP, GIF allowed' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 400 })
    }

    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
    const slug = productSlug || 'product'
    const r2Key = `thumbnails/${slug}-${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(r2Key, buffer, file.type)

    // Generate a long-lived signed URL (30 days)
    const url = await generateDownloadUrl(r2Key, 30 * 24 * 60 * 60)

    return NextResponse.json({ url, r2Key })
  } catch (error) {
    console.error('[Thumbnail upload] Error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
