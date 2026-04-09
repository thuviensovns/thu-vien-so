import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** POST: Create the first admin user (only works when no users exist) */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    // Check if any users already exist
    const existing = await payload.find({
      collection: 'users',
      limit: 1,
    })

    if (existing.totalDocs > 0) {
      return NextResponse.json(
        { error: 'Đã có tài khoản trong hệ thống. Không thể tạo thêm admin qua API này.' },
        { status: 403 }
      )
    }

    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { email, password, displayName } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email và mật khẩu là bắt buộc' }, { status: 400 })
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Invalid field types' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 8 ký tự' }, { status: 400 })
    }

    // Create admin user
    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        displayName: displayName || 'Admin',
        role: 'admin',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Tài khoản admin đã được tạo thành công!',
      user: { id: user.id, email: user.email, role: 'admin' },
    })
  } catch (error: any) {
    console.error('[Setup] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Không thể tạo tài khoản' },
      { status: 500 }
    )
  }
}

/** GET: Check if setup is needed (no users in database) */
export async function GET() {
  try {
    const payload = await getPayloadForApi()
    const existing = await payload.find({
      collection: 'users',
      limit: 1,
    })

    return NextResponse.json({
      needsSetup: existing.totalDocs === 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Database connection failed', details: error?.message },
      { status: 500 }
    )
  }
}
