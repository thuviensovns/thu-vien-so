import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** Create a pending top-up request */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { amount?: number; transferCode?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const amount = Number(body?.amount)
    if (!amount || amount < 10000 || amount > 100000000) {
      return NextResponse.json({ error: 'Invalid amount (min 10,000 VND)' }, { status: 400 })
    }

    // Fixed transfer code per user: NAPKH + zero-padded userId
    const clientCode = typeof body?.transferCode === 'string' ? body.transferCode.trim().toUpperCase() : ''
    const FIXED_RE = /^NAPKH\d{4,}$/
    const transferCode = FIXED_RE.test(clientCode)
      ? clientCode
      : `NAPKH${String(user.id).padStart(4, '0')}`

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    // Upsert: if a pending topup with this fixed code exists, update its amount
    const existing = await payload.find({
      collection: 'topups',
      where: {
        transferCode: { equals: transferCode },
        status: { equals: 'pending' },
      },
      limit: 1,
    })

    let topup
    if (existing.totalDocs > 0) {
      // Update existing pending topup with new amount and extend expiry
      topup = await payload.update({
        collection: 'topups',
        id: existing.docs[0].id,
        data: { amount, expiresAt },
      })
    } else {
      // Create new pending topup
      try {
        topup = await payload.create({
          collection: 'topups',
          data: { user: user.id, amount, transferCode, status: 'pending', expiresAt },
        })
      } catch (createErr) {
        const m = (createErr as Error).message || ''
        if (/unique|duplicate/i.test(m)) {
          // A completed topup with this code exists — find and update the existing pending one
          // or the code was already used. Expire old completed ones won't help (unique constraint).
          // Generate a one-time fallback code for this specific transaction.
          const fallbackCode = `${transferCode}${Date.now().toString(36).slice(-4).toUpperCase()}`
          topup = await payload.create({
            collection: 'topups',
            data: { user: user.id, amount, transferCode: fallbackCode, status: 'pending', expiresAt },
          })
          return NextResponse.json({
            id: topup.id,
            transferCode: fallbackCode,
            amount,
            status: 'pending',
            expiresAt,
          })
        }
        throw createErr
      }
    }

    // Fire a background Web2M poll (throttled, non-blocking) so that if the
    // bank notification arrived between the user clicking "đã chuyển khoản"
    // and reaching this line, the credit lands in the next ~5s of polling
    // rather than waiting for the scheduled cron.
    if (process.env.CRON_SECRET) {
      const host = req.nextUrl.origin
      const triggerUrl = `${host}/api/cron/poll-web2m?token=${process.env.CRON_SECRET}&throttle=3000`
      fetch(triggerUrl, { cache: 'no-store' }).catch(() => { /* non-blocking */ })
    }

    return NextResponse.json({
      id: topup.id,
      transferCode,
      amount,
      status: 'pending',
      expiresAt,
    })
  } catch (error) {
    console.error('[TopUp] Create error:', error)
    const msg = (error as Error).message
    if (msg === 'timeout' || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
