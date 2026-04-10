import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** POST: Mark topup notifications as read by admin
 *  Body: { all: true } — mark all, or { ids: [1,2,3] } — mark specific */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { all?: boolean; ids?: number[] }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    let marked = 0

    if (body.all) {
      // Find all unread completed topups
      try {
        const unread = await payload.find({
          collection: 'topups',
          where: {
            status: { equals: 'completed' },
            readByAdmin: { not_equals: true },
          },
          limit: 100,
          overrideAccess: true,
        })

        for (const doc of unread.docs) {
          await payload.update({
            collection: 'topups',
            id: doc.id,
            data: { readByAdmin: true },
            overrideAccess: true,
          })
          marked++
        }
      } catch (e) {
        console.warn('[MarkRead] readByAdmin query failed:', (e as Error).message)
      }
    } else if (body.ids?.length) {
      for (const id of body.ids.slice(0, 50)) {
        try {
          await payload.update({
            collection: 'topups',
            id,
            data: { readByAdmin: true },
            overrideAccess: true,
          })
          marked++
        } catch { /* skip invalid ids */ }
      }
    }

    return NextResponse.json({ success: true, marked })
  } catch (error) {
    console.error('Mark topup read error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
