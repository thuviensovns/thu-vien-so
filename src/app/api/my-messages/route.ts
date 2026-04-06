import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/**
 * GET /api/my-messages
 * Returns contact messages belonging to the authenticated user (matched by email).
 * SECURITY: Only uses server-side auth — no email query param to prevent IDOR.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    // SECURITY: Only accept Payload cookie auth — no query param fallback
    let userEmail: string | null = null
    try {
      const { user } = await payload.auth({ headers: req.headers })
      if (user?.email) userEmail = user.email
    } catch {
      // Auth failed
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Vui lòng đăng nhập để xem tin nhắn', messages: [], totalDocs: 0 },
        { status: 401 },
      )
    }

    const messages = await payload.find({
      collection: 'contact-messages',
      where: { email: { equals: userEmail } },
      sort: '-createdAt',
      limit: 50,
      overrideAccess: true,
    })

    return NextResponse.json({
      messages: messages.docs.map((msg: any) => ({
        id: msg.id,
        name: msg.name,
        email: msg.email,
        subject: msg.subject,
        message: msg.message,
        status: msg.status,
        adminNote: msg.adminNote || null,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
      totalDocs: messages.totalDocs,
    })
  } catch (error) {
    console.error('My messages error:', error)
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'timeout' || msg.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Hệ thống đang bận, vui lòng thử lại sau', messages: [], totalDocs: 0 },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: 'Đã có lỗi xảy ra', messages: [], totalDocs: 0 },
      { status: 500 },
    )
  }
}
