import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_EXTENSIONS = ['zip', 'rar', '7z', 'flp', 'wav', 'mp3', 'mp4', 'flac', 'aif', 'aiff', 'mid', 'midi', 'fxp', 'fxb', 'nki', 'dll', 'vst3', 'au', 'component']

/**
 * Vercel Blob client-upload handshake. The browser library
 * (`@vercel/blob/client.upload`) calls this endpoint to obtain a short-lived
 * upload token, then streams the file directly to Blob storage — bypassing
 * the Vercel function 4.5MB body cap entirely.
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
          throw new Error(`Định dạng .${ext} không được hỗ trợ. Hỗ trợ: ${ALLOWED_EXTENSIONS.join(', ')}`)
        }
        return {
          allowedContentTypes: [
            'application/zip', 'application/x-zip-compressed',
            'application/x-rar-compressed', 'application/vnd.rar',
            'application/x-7z-compressed',
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
            'audio/flac', 'audio/x-flac', 'audio/aiff', 'audio/x-aiff',
            'audio/midi', 'audio/x-midi', 'audio/basic',
            'video/mp4', 'audio/mp4', 'application/mp4',
            'application/x-msdownload', 'application/octet-stream',
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({ adminEmail: user.email, type: 'product-file' }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Note: only fires on deployed Vercel, not localhost
        console.log(`[Blob upload] file completed: ${blob.pathname} by ${tokenPayload}`)
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Blob handshake file] Error:', error)
    const msg = error instanceof Error ? error.message : 'Handshake failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
