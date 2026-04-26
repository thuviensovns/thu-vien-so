import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { isR2Configured, uploadToR2, generateDownloadUrl } from '@/lib/r2'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** POST: Upload a product thumbnail image to R2, returns a public URL. */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
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

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình R2. Thêm R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME vào env.' },
        { status: 503 },
      )
    }

    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
    const slug = productSlug || 'product'
    const fileName = `${slug}-${Date.now()}.${ext}`
    const r2Key = `thumbnails/${fileName}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(r2Key, buffer, file.type)
    const url = await generateDownloadUrl(r2Key, 315360000)
    return NextResponse.json({ url, r2Key })
  } catch (error) {
    console.error('[Thumbnail upload] Error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
