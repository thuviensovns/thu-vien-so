import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    // SECURITY: Require admin authentication
    let isAdmin = false
    try {
      const { user } = await payload.auth({ headers: req.headers })
      isAdmin = user?.role === 'admin'
    } catch { /* ignore */ }

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get unread contact messages count + recent messages
    const [newMessages, recentMessages] = await Promise.all([
      payload.find({
        collection: 'contact-messages',
        where: { status: { equals: 'new' } },
        limit: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'contact-messages',
        sort: '-createdAt',
        limit: 20,
        overrideAccess: true,
      }),
    ])

    // Topup notifications — wrapped in try/catch in case readByAdmin column
    // hasn't been synced to DB yet (Payload push: true runs on first access)
    let unreadTopUpCount = 0
    let topUpDocs: Record<string, unknown>[] = []
    try {
      const unreadTopUps = await payload.find({
        collection: 'topups',
        where: {
          status: { equals: 'completed' },
          readByAdmin: { not_equals: true },
        },
        sort: '-confirmedAt',
        limit: 20,
        depth: 1,
        overrideAccess: true,
      })
      unreadTopUpCount = unreadTopUps.totalDocs
      topUpDocs = unreadTopUps.docs as unknown as Record<string, unknown>[]
    } catch (e) {
      // readByAdmin column may not exist yet — fallback: query without it
      console.warn('[Notifications] topup query failed, trying fallback:', (e as Error).message)
      try {
        const fallback = await payload.find({
          collection: 'topups',
          where: { status: { equals: 'completed' } },
          sort: '-confirmedAt',
          limit: 20,
          depth: 1,
          overrideAccess: true,
        })
        unreadTopUpCount = fallback.totalDocs
        topUpDocs = fallback.docs as unknown as Record<string, unknown>[]
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      unreadCount: newMessages.totalDocs + unreadTopUpCount,
      unreadMessages: newMessages.totalDocs,
      unreadTopUps: unreadTopUpCount,
      recent: recentMessages.docs.map((msg) => ({
        id: msg.id,
        name: msg.name,
        email: msg.email,
        subject: msg.subject,
        message: msg.message,
        status: msg.status,
        adminNote: msg.adminNote,
        ipAddress: msg.ipAddress,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
      recentTopUps: topUpDocs.map((t) => {
        const user = typeof t.user === 'object' && t.user ? (t.user as Record<string, unknown>) : null
        return {
          id: t.id,
          type: 'topup' as const,
          userName: (user?.displayName as string) || null,
          userEmail: (user?.email as string) || null,
          amount: t.amount,
          transferCode: t.transferCode,
          confirmedAt: t.confirmedAt,
        }
      }),
    })
  } catch (error) {
    console.error('Notifications error:', error)
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'timeout' || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
