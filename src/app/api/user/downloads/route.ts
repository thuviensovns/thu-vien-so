import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'

/** GET /api/user/downloads?limit=20
 *
 *  Lean replacement for Payload's /api/downloads?depth=1 endpoint.
 *  Payload's REST with depth=1 pulls richText description, gallery, tags,
 *  downloadLog audit array, full user, full order — megabytes per request.
 *  This returns only what DownloadsTab.tsx actually renders: ~5 fields per row.
 *
 *  Image resolution mirrors product-mapper.ts: prefer products.thumbnail_url
 *  (R2/external), fall back to Payload media via thumbnail_id JOIN.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ docs: [] }, { status: 401 })
    }

    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 20, 1), 100)
    const pool = getDbPool()
    const { rows } = await pool.query(
      `SELECT d.id,
              d.download_count,
              d.max_downloads,
              d.expires_at,
              d.created_at,
              p.id   AS product_id,
              p.name AS product_name,
              p.slug AS product_slug,
              p.type AS product_type,
              p.thumbnail_url AS product_thumbnail_url,
              m.url           AS product_thumbnail_media_url,
              p.preview_audio_url   AS preview_audio_url,
              p.preview_audio_r2_key AS preview_audio_r2_key,
              am.url                AS preview_audio_media_url,
              p.preview_bpm         AS preview_bpm,
              p.preview_musical_key AS preview_musical_key,
              p.preview_duration    AS preview_duration,
              p.video_url           AS video_url,
              p.video_r2_key        AS video_r2_key,
              p.video_mime_type     AS video_mime_type,
              o.id           AS order_id,
              o.order_number AS order_number
       FROM downloads d
       LEFT JOIN products p ON p.id = d.product_id
       LEFT JOIN media    m ON m.id = p.thumbnail_id
       LEFT JOIN media    am ON am.id = p.preview_audio_file_id
       LEFT JOIN orders   o ON o.id = d.order_id
       WHERE d.user_id = $1
       ORDER BY d.created_at DESC
       LIMIT $2`,
      [user.id, limit],
    )

    const docs = rows.map((r: Record<string, unknown>) => {
      const thumbUrl =
        (r.product_thumbnail_url as string | null) ||
        (r.product_thumbnail_media_url as string | null) ||
        ''
      const audioUrl =
        (r.preview_audio_url as string | null) ||
        (r.preview_audio_r2_key as string | null) ||
        (r.preview_audio_media_url as string | null) ||
        ''
      const videoUrl = (r.video_url as string | null) || ''
      const videoR2Key = (r.video_r2_key as string | null) || ''
      return {
        id: String(r.id),
        downloadCount: Number(r.download_count || 0),
        maxDownloads: Number(r.max_downloads || 0),
        expiresAt: r.expires_at ? String(r.expires_at) : '',
        createdAt: r.created_at ? String(r.created_at) : '',
        product: r.product_id
          ? {
              id: String(r.product_id),
              name: String(r.product_name || ''),
              slug: String(r.product_slug || ''),
              type: String(r.product_type || ''),
              thumbnailUrl: thumbUrl,
              preview: {
                audioUrl,
                bpm: r.preview_bpm != null ? Number(r.preview_bpm) : null,
                musicalKey: r.preview_musical_key ? String(r.preview_musical_key) : null,
                duration: r.preview_duration != null ? Number(r.preview_duration) : null,
              },
              video: {
                url: videoUrl,
                r2Key: videoR2Key,
                mimeType: r.video_mime_type ? String(r.video_mime_type) : '',
              },
            }
          : null,
        order: r.order_id
          ? { id: String(r.order_id), orderNumber: String(r.order_number || '') }
          : null,
      }
    })

    const res = NextResponse.json({ docs, totalDocs: docs.length })
    // Tab-switch returns hit cache; refresh button is a manual no-store request.
    res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=60')
    return res
  } catch (error) {
    console.error('[user/downloads] error:', error)
    const msg = (error as Error).message
    if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ docs: [], error: 'DB tạm thời không khả dụng' }, { status: 503 })
    }
    return NextResponse.json({ docs: [], error: 'Internal error' }, { status: 500 })
  }
}
