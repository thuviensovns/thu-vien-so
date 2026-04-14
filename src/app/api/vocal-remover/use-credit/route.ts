import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import type { User } from '@/types/payload-types'

export const dynamic = 'force-dynamic'

/** Deduct balance for 7-track AI separation usage */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { fee?: number }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const fee = body?.fee
    if (!fee || fee <= 0) {
      return NextResponse.json({ error: 'Invalid fee amount' }, { status: 400 })
    }

    // Get fresh balance
    const freshUser = await payload.findByID({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
    }) as User

    const currentBalance = freshUser.balance || 0

    if (currentBalance < fee) {
      return NextResponse.json({
        error: 'Số dư không đủ',
        balance: currentBalance,
        required: fee,
      }, { status: 402 })
    }

    // Deduct balance
    const newBalance = currentBalance - fee
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { balance: newBalance },
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      newBalance,
      deducted: fee,
    })
  } catch (err) {
    console.error('[vocal-remover/use-credit] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Check balance and fee for 7-track */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get fresh balance
    const freshUser = await payload.findByID({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
    }) as User

    return NextResponse.json({
      balance: freshUser.balance || 0,
      isAdmin: freshUser.role === 'admin',
    })
  } catch (err) {
    console.error('[vocal-remover/use-credit] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
