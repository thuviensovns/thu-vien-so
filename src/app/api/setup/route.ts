import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'

/** POST: Create the admin account (only works when no users exist) */
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
        { error: 'Hệ thống đã được thiết lập. Không thể tạo thêm admin.' },
        { status: 403 }
      )
    }

    // Create the one and only admin account
    const user = await payload.create({
      collection: 'users',
      data: {
        email: ADMIN_EMAIL,
        password: 'Anhdungpro1@',
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
