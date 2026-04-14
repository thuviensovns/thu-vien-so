import { NextRequest, NextResponse } from 'next/server'

/**
 * GET proxy that streams a YouTube CDN URL back with Content-Disposition: attachment
 * so the browser downloads the file directly (no new tab).
 *
 * Query params:
 *   cdnUrl   – pre-resolved googlevideo.com URL (from /download endpoint)
 *   filename – desired download filename (URL-encoded)
 */
export async function GET(req: NextRequest) {
  const cdnUrl = req.nextUrl.searchParams.get('cdnUrl')
  const filename = req.nextUrl.searchParams.get('filename') || 'download'

  if (!cdnUrl) {
    return NextResponse.json({ error: 'Missing cdnUrl' }, { status: 400 })
  }

  // Security: only allow YouTube CDN domains
  try {
    const parsed = new URL(cdnUrl)
    if (!parsed.hostname.endsWith('.googlevideo.com') && !parsed.hostname.endsWith('.youtube.com')) {
      return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
  }

  try {
    const upstream = await fetch(cdnUrl)

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'Không thể tải file từ YouTube' },
        { status: 502 }
      )
    }

    const headers = new Headers()
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)

    const contentType = upstream.headers.get('content-type')
    if (contentType) headers.set('Content-Type', contentType)

    const contentLength = upstream.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)

    return new NextResponse(upstream.body as ReadableStream, { headers })
  } catch {
    return NextResponse.json(
      { error: 'Lỗi kết nối đến YouTube' },
      { status: 502 }
    )
  }
}
