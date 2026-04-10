import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** POST: Upload a product thumbnail image, returns a public URL.
 *  Priority: R2 → Vercel Blob → error */
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

    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
    const slug = productSlug || 'product'
    const fileName = `${slug}-${Date.now()}.${ext}`

    // --- Strategy 1: R2 ---
    const hasR2 = process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME
    if (hasR2) {
      try {
        const { uploadToR2, generateDownloadUrl } = await import('@/lib/r2')
        const r2Key = `thumbnails/${fileName}`
        const buffer = Buffer.from(await file.arrayBuffer())
        await uploadToR2(r2Key, buffer, file.type)
        const url = await generateDownloadUrl(r2Key, 315360000)
        return NextResponse.json({ url, r2Key })
      } catch (e) {
        console.error('[Thumbnail] R2 upload failed:', e)
        // Fall through to Vercel Blob
      }
    }

    // --- Strategy 2: Vercel Blob ---
    const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN
    if (hasBlobToken) {
      try {
        const { put } = await import('@vercel/blob')
        const blob = await put(`thumbnails/${fileName}`, file, {
          access: 'public',
          contentType: file.type,
        })
        return NextResponse.json({ url: blob.url })
      } catch (e) {
        console.error('[Thumbnail] Vercel Blob upload failed:', e)
      }
    }

    return NextResponse.json(
      { error: 'Chưa cấu hình storage. Thêm BLOB_READ_WRITE_TOKEN (Vercel Blob) hoặc R2 env vars.' },
      { status: 503 },
    )
  } catch (error) {
    console.error('[Thumbnail upload] Error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
