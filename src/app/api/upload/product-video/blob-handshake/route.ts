import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_EXTENSIONS = ['mp4', 'webm', 'mov']

/**
 * Vercel Blob client-upload handshake for product demo videos.
 * Browser library streams directly to Blob storage, bypassing Vercel's
 * 4.5MB function body cap.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as HandleUploadBody

    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const ext = pathname.split('.').pop()?.toLowerCase() || ''
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          throw new Error(`Định dạng .${ext} không hỗ trợ. Hỗ trợ: ${ALLOWED_EXTENSIONS.join(', ')}`)
        }
        return {
          allowedContentTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({ adminEmail: user.email, type: 'product-video' }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log(`[Blob upload] video completed: ${blob.pathname} by ${tokenPayload}`)
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Blob handshake video] Error:', error)
    const msg = error instanceof Error ? error.message : 'Handshake failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
