import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { isR2Configured, getPresignedUploadUrl } from '@/lib/r2'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_EXTENSIONS = ['zip', 'rar', '7z', 'flp', 'wav', 'mp3', 'mp4', 'flac', 'aif', 'aiff', 'mid', 'midi', 'fxp', 'fxb', 'nki', 'dll', 'vst3', 'au', 'component']

/**
 * Returns instructions for the client to upload a product file:
 *  - mode: 'presign' → PUT directly to R2 at `url` (production path; bypasses Vercel 4.5MB body limit)
 *  - mode: 'direct'  → POST file to /api/upload/product-file (local dev fallback when R2 unconfigured)
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as { fileName?: string; fileSize?: number; contentType?: string; productSlug?: string } | null
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    const { fileName, fileSize, contentType, productSlug } = body
    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
    }
    if (typeof fileSize !== 'number' || fileSize <= 0) {
      return NextResponse.json({ error: 'fileSize is required' }, { status: 400 })
    }
    if (!productSlug || typeof productSlug !== 'string') {
      return NextResponse.json({ error: 'productSlug is required' }, { status: 400 })
    }
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File quá lớn. Tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 })
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Định dạng .${ext} không được hỗ trợ. Hỗ trợ: ${ALLOWED_EXTENSIONS.join(', ')}` }, { status: 400 })
    }

    const timestamp = Date.now()
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const safeSlug = productSlug.replace(/[^a-zA-Z0-9._-]/g, '_')
    const r2Key = `products/${safeSlug}/${timestamp}-${safeFileName}`
    const safeContentType = contentType && typeof contentType === 'string' ? contentType : 'application/octet-stream'

    if (isR2Configured()) {
      const url = await getPresignedUploadUrl(r2Key, safeContentType, 600)
      console.log(`[Presign] Admin ${user.email} → ${r2Key} (${(fileSize / 1024 / 1024).toFixed(1)}MB, ${safeContentType})`)
      return NextResponse.json({
        mode: 'presign',
        url,
        r2Key,
        fileName,
        fileSize,
        fileFormat: ext,
        contentType: safeContentType,
      })
    }

    // R2 unconfigured (local dev) — tell client to POST through the existing endpoint,
    // which routes to the local filesystem fallback in lib/r2.
    return NextResponse.json({
      mode: 'direct',
      r2Key,
      fileName,
      fileSize,
      fileFormat: ext,
    })
  } catch (error) {
    console.error('[Presign] Error:', error)
    const msg = error instanceof Error ? error.message : 'Presign failed'
    return NextResponse.json({ error: `Tạo URL upload thất bại: ${msg}` }, { status: 500 })
  }
}
