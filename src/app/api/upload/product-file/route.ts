import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const ALLOWED_EXTENSIONS = ['zip', 'rar', '7z', 'flp', 'wav', 'mp3', 'mp4', 'flac', 'aif', 'aiff', 'mid', 'midi', 'fxp', 'fxb', 'nki', 'dll', 'vst3', 'au', 'component']

// Map extensions to allowed MIME types (prevents extension spoofing)
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  zip: ['application/zip', 'application/x-zip-compressed'],
  rar: ['application/x-rar-compressed', 'application/vnd.rar'],
  '7z': ['application/x-7z-compressed'],
  flp: ['application/octet-stream'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/wave'],
  mp3: ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/mpeg3', 'audio/x-mp3'],
  mp4: ['video/mp4', 'audio/mp4', 'application/mp4'],
  flac: ['audio/flac', 'audio/x-flac'],
  aif: ['audio/aiff', 'audio/x-aiff'],
  aiff: ['audio/aiff', 'audio/x-aiff'],
  mid: ['audio/midi', 'audio/x-midi'],
  midi: ['audio/midi', 'audio/x-midi'],
  fxp: ['application/octet-stream'],
  fxb: ['application/octet-stream'],
  nki: ['application/octet-stream'],
  dll: ['application/x-msdownload', 'application/octet-stream'],
  vst3: ['application/octet-stream'],
  au: ['audio/basic', 'application/octet-stream'],
  component: ['application/octet-stream'],
}

/** POST: Admin uploads a product file to R2 */
export async function POST(req: NextRequest) {
  try {
    // Auth check — admin only
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

    if (!productSlug) {
      return NextResponse.json({ error: 'Product slug is required' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File quá lớn. Tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 })
    }

    // Validate extension
    const fileName = file.name
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Định dạng .${ext} không được hỗ trợ. Hỗ trợ: ${ALLOWED_EXTENSIONS.join(', ')}` }, { status: 400 })
    }

    // Validate MIME type matches extension (prevents extension spoofing)
    const allowedMimes = ALLOWED_MIME_TYPES[ext]
    if (allowedMimes && file.type && !allowedMimes.includes(file.type)) {
      return NextResponse.json({ error: `MIME type "${file.type}" không khớp với định dạng .${ext}` }, { status: 400 })
    }

    // Generate R2 key: products/{slug}/{timestamp}-{filename}
    const timestamp = Date.now()
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const r2Key = `products/${productSlug}/${timestamp}-${safeFileName}`

    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(r2Key, buffer, file.type || 'application/octet-stream')

    console.log(`[Upload] Admin ${user.email} uploaded ${fileName} (${(file.size / 1024 / 1024).toFixed(1)}MB) → ${r2Key}`)

    return NextResponse.json({
      r2Key,
      fileName,
      fileSize: file.size,
      fileFormat: ext,
    })
  } catch (error) {
    console.error('[Upload] Error:', error)
    const msg = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: `Upload thất bại: ${msg}` }, { status: 500 })
  }
}

/** DELETE: Admin removes a product file from R2 */
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
    console.log(`[Upload] Admin ${user.email} deleted file: ${r2Key}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Upload] Delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
