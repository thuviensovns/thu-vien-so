import { NextResponse } from 'next/server'

// SECURITY: Read from env vars — NEVER hardcode credentials
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL || ''
const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || ''

async function getPayloadSafe() {
  const { getPayload } = await import('payload')
  const config = (await import('@payload-config')).default
  return getPayload({ config })
}

/** POST: Create the admin account (only works when no users exist) */
export async function POST() {
  try {
    const payload = await getPayloadSafe()

    // Check if any users already exist
    const existing = await payload.find({
      collection: 'users',
      limit: 1,
    })

    if (existing.totalDocs > 0) {
      return NextResponse.json(
        { error: 'Hệ thống đã được thiết lập. Không thể tạo thêm admin.' },
        { status: 403 }
      )
    }

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'INITIAL_ADMIN_EMAIL và INITIAL_ADMIN_PASSWORD chưa được cấu hình trong env.' },
        { status: 500 }
      )
    }

    // Create the one and only admin account
    const user = await payload.create({
      collection: 'users',
      data: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: 'Admin',
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
    const payload = await getPayloadSafe()
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

export const maxDuration = 60
