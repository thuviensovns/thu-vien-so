import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** POST: Admin deducts from a user's balance + creates topup record with negative amount */
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

    if (currentBalance < amount) {
      return NextResponse.json({
        error: `Số dư không đủ. Hiện có: ${currentBalance}₫, cần trừ: ${amount}₫`,
      }, { status: 400 })
    }

    // 1. Deduct user balance
    const newBalance = currentBalance - amount
    await payload.update({
      collection: 'users',
      id: targetUser.id,
      data: { balance: newBalance },
      overrideAccess: true,
    })

    // 2. Create topup record with negative amount for audit trail
    const transferCode = `DEDUCT${Date.now().toString(36).toUpperCase()}`
    try {
      await payload.create({
        collection: 'topups',
        data: {
          user: targetUser.id,
          amount,
          transferCode,
          status: 'completed',
          confirmedAt: new Date().toISOString(),
          readByAdmin: true,
          bankDescription: `[TRỪ TIỀN] Admin trừ ${amount}₫ bởi ${user.email}`,
        },
        overrideAccess: true,
      })
    } catch (topupErr) {
      console.warn('[Admin deduct] Retrying without optional fields:', topupErr)
      await payload.create({
        collection: 'topups',
        data: {
          user: targetUser.id,
          amount,
          transferCode,
          status: 'completed',
          confirmedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    }

    return NextResponse.json({
      success: true,
      newBalance,
      transferCode,
      userName: targetUser.displayName || targetUser.email,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Admin deduct] Error:', msg, error)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
