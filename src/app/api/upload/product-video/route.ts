import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

// Vercel Hobby caps request body at 4.5MB. Keep admins on external URLs for
// larger demo clips — the UI warns before the file hits the API.
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB (self-hosted ceiling)
const ALLOWED_EXTENSIONS = ['mp4', 'webm', 'mov']
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  mp4: ['video/mp4'],
  webm: ['video/webm'],
  mov: ['video/quicktime', 'video/mp4'],
}

/** POST: Admin uploads a product demo video to R2 */
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

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!productSlug) return NextResponse.json({ error: 'Product slug is required' }, { status: 400 })

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File quá lớn. Tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 })
    }

    const fileName = file.name
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Định dạng .${ext} không hỗ trợ. Hỗ trợ: ${ALLOWED_EXTENSIONS.join(', ')}` }, { status: 400 })
    }

    const allowedMimes = ALLOWED_MIME_TYPES[ext]
    if (allowedMimes && file.type && !allowedMimes.includes(file.type)) {
      return NextResponse.json({ error: `MIME type "${file.type}" không khớp với định dạng .${ext}` }, { status: 400 })
    }

    const timestamp = Date.now()
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const r2Key = `products/${productSlug}/video-${timestamp}-${safeFileName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(r2Key, buffer, file.type || 'video/mp4')

    console.log(`[Upload] Admin ${user.email} uploaded video ${fileName} (${(file.size / 1024 / 1024).toFixed(1)}MB) → ${r2Key}`)

    return NextResponse.json({
      r2Key,
      fileName,
      fileSize: file.size,
      mimeType: file.type || `video/${ext}`,
    })
  } catch (error) {
    console.error('[Upload video] Error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

/** DELETE: Admin removes a product video from R2 */
export async function DELETE(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { r2Key } = await req.json()
    if (!r2Key || typeof r2Key !== 'string') {
      return NextResponse.json({ error: 'r2Key is required' }, { status: 400 })
    }

    await deleteFromR2(r2Key)
    console.log(`[Upload] Admin ${user.email} deleted video: ${r2Key}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Upload video] Delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
