import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Direct POST path: small files (≤ ~4MB) only. Larger uploads go through the
// presign endpoint and stream straight to R2.
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'oga', 'webm']
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  mp3: ['audio/mpeg', 'audio/mp3'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/wave'],
  flac: ['audio/flac', 'audio/x-flac'],
  aac: ['audio/aac', 'audio/mp4'],
  m4a: ['audio/mp4', 'audio/x-m4a'],
  ogg: ['audio/ogg'],
  oga: ['audio/ogg'],
  webm: ['audio/webm'],
}

/** POST: Admin uploads a product demo audio to R2 */
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
    const r2Key = `products/${productSlug}/audio-${timestamp}-${safeFileName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(r2Key, buffer, file.type || 'audio/mpeg')

    console.log(`[Upload] Admin ${user.email} uploaded audio ${fileName} (${(file.size / 1024 / 1024).toFixed(1)}MB) → ${r2Key}`)

    return NextResponse.json({
      r2Key,
      fileName,
      fileSize: file.size,
      mimeType: file.type || `audio/${ext}`,
    })
  } catch (error) {
    console.error('[Upload audio] Error:', error)
    const msg = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: `Upload thất bại: ${msg}` }, { status: 500 })
  }
}

/** DELETE: Admin removes a product audio from R2 */
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
    console.log(`[Upload] Admin ${user.email} deleted audio: ${r2Key}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Upload audio] Delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
