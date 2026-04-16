import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** In-process memo: site-content is a global singleton that changes rarely
 *  (only when an admin saves the settings panel). Every visitor polls this
 *  endpoint, so serving from memory for 30s eliminates almost all DB load. */
let memoAt = 0
let memoBody: { settings: Record<string, unknown> | null; categoryDescriptions: Record<string, string> | null } | null = null
const MEMO_TTL_MS = 30_000

/** GET: Public — returns site content (settings + category descriptions) */
export async function GET() {
  try {
    const now = Date.now()
    if (memoBody && now - memoAt < MEMO_TTL_MS) {
      return NextResponse.json(memoBody, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
      })
    }

    const payload = await getPayloadForApi()
    const data = await payload.findGlobal({ slug: 'site-content' }) as { settings?: Record<string, unknown> | null; categoryDescriptions?: Record<string, string> | null }

    memoBody = {
      settings: data?.settings || null,
      categoryDescriptions: data?.categoryDescriptions || null,
    }
    memoAt = now

    return NextResponse.json(memoBody, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    })
  } catch {
    return NextResponse.json({ settings: null, categoryDescriptions: null })
  }
}

/** POST: Admin-only — update site content */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { settings?: unknown; categoryDescriptions?: unknown }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.settings !== undefined) updateData.settings = body.settings
    if (body.categoryDescriptions !== undefined) updateData.categoryDescriptions = body.categoryDescriptions

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No data to update' }, { status: 400 })
    }

    await payload.updateGlobal({
      slug: 'site-content',
      data: updateData,
    })

    memoBody = null
    memoAt = 0

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SiteContent] Update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
