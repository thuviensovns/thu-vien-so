import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import type { ContactMessage } from '@/types/payload-types'

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

    // Get unread contact messages count
    const newMessages = await payload.find({
      collection: 'contact-messages',
      where: { status: { equals: 'new' } },
      limit: 0,
      overrideAccess: true,
    })

    // Get recent contact messages (last 20)
    const recentMessages = await payload.find({
      collection: 'contact-messages',
      sort: '-createdAt',
      limit: 20,
      overrideAccess: true,
    })

    return NextResponse.json({
      unreadCount: newMessages.totalDocs,
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
