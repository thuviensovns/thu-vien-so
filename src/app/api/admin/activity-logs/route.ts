import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** GET: List activity logs */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const search = req.nextUrl.searchParams.get('search') || ''
    const type = req.nextUrl.searchParams.get('type') || ''
    const page = Number(req.nextUrl.searchParams.get('page')) || 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (search) {
      where.or = [
        { action: { contains: search } },
        { detail: { contains: search } },
      ]
    }
    if (type && type !== 'all') {
      where.type = { equals: type }
    }

    const logs = await payload.find({
      collection: 'activity-logs',
      where,
      sort: '-createdAt',
      limit: 50,
      page,
      overrideAccess: true,
    })

    return NextResponse.json({
      docs: logs.docs.map((l) => ({
        id: l.id,
        type: l.type,
        action: l.action,
        detail: l.detail || '',
        adminEmail: l.adminEmail || '',
        timestamp: l.createdAt,
      })),
      totalDocs: logs.totalDocs,
      totalPages: logs.totalPages,
      page: logs.page,
    })
  } catch (error) {
    console.error('[Admin activity-logs] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** POST: Create a new log entry */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { type?: string; action?: string; detail?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (!body.type || !body.action) {
      return NextResponse.json({ error: 'Missing type or action' }, { status: 400 })
    }

    await payload.create({
      collection: 'activity-logs',
      data: {
        type: body.type as 'order' | 'user' | 'topup' | 'coupon' | 'product' | 'settings' | 'system',
        action: body.action,
        detail: body.detail || '',
        adminEmail: user.email,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin activity-logs] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** DELETE: Clear all logs */
export async function DELETE(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await payload.delete({
      collection: 'activity-logs',
      where: { id: { exists: true } },
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin activity-logs] DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
