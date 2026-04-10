import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** GET: List topups from DB for admin management page */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const search = req.nextUrl.searchParams.get('search') || ''
    const page = Number(req.nextUrl.searchParams.get('page')) || 1

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (search) {
      where.or = [
        { transferCode: { contains: search } },
      ]
    }

    const topups = await payload.find({
      collection: 'topups',
      where,
      sort: '-createdAt',
      limit: 50,
      page,
      depth: 1, // populate user
      overrideAccess: true,
    })

    return NextResponse.json({
      docs: topups.docs.map((t) => {
        const u = typeof t.user === 'object' && t.user ? t.user : null
        return {
          id: t.id,
          userEmail: (u as Record<string, unknown>)?.email || 'Unknown',
          userName: (u as Record<string, unknown>)?.displayName || null,
          userId: u ? (u as Record<string, unknown>).id : null,
          amount: t.amount,
          transferCode: t.transferCode,
          status: t.status,
          bankTransactionId: t.bankTransactionId,
          confirmedAt: t.confirmedAt,
          createdAt: t.createdAt,
        }
      }),
      totalDocs: topups.totalDocs,
      totalPages: topups.totalPages,
      page: topups.page,
    })
  } catch (error) {
    console.error('[Admin topups] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** POST: Admin manually credits a user's balance + creates topup record */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { email?: string; amount?: number }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const email = body.email?.trim()
    const amount = Number(body.amount)

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!amount || amount < 1000) {
      return NextResponse.json({ error: 'Số tiền tối thiểu 1.000₫' }, { status: 400 })
    }

    // Find user by email
    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })

    if (users.docs.length === 0) {
      return NextResponse.json({ error: `Không tìm thấy user với email: ${email}` }, { status: 404 })
    }

    const targetUser = users.docs[0]
    const currentBalance = Number(targetUser.balance || 0)

    // 1. Credit user balance
    await payload.update({
      collection: 'users',
      id: targetUser.id,
      data: { balance: currentBalance + amount },
      overrideAccess: true,
    })

    // 2. Create topup record
    const transferCode = `ADMIN${Date.now().toString(36).toUpperCase()}`
    await payload.create({
      collection: 'topups',
      data: {
        user: targetUser.id,
        amount,
        transferCode,
        status: 'completed',
        confirmedAt: new Date().toISOString(),
        readByAdmin: true, // admin did it themselves, no need to notify
        bankDescription: `Admin cộng thủ công bởi ${user.email}`,
      },
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      newBalance: currentBalance + amount,
      transferCode,
      userName: targetUser.displayName || targetUser.email,
    })
  } catch (error) {
    console.error('[Admin manual topup] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
