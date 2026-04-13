import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** POST: Admin resets a customer's password */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { userId?: string | number; newPassword?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const userId = body.userId
    const newPassword = body.newPassword?.trim()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 })
    }

    // Verify target user exists
    const targetUser = await payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 })
    }

    // Update password — Payload auto-hashes it
    await payload.update({
      collection: 'users',
      id: userId,
      data: { password: newPassword },
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      userName: targetUser.displayName || targetUser.email,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Admin reset-password] Error:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
