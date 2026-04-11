import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import crypto from 'crypto'

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

    // Prefer the client-generated transferCode when it matches the expected
    // NAP + 8 hex-uppercase format (same entropy as server-side crypto.randomBytes(4)).
    // This is required because the client already rendered the QR with that code and
    // the user transfers with that exact memo — if we swap it server-side, the Sepay
    // webhook cannot match the transaction to this topup and the balance never lands.
    // Collisions are rejected by the `unique: true` DB constraint on `topupCode` → we
    // retry once with a server-generated code.
    const clientCode = typeof body?.transferCode === 'string' ? body.transferCode.trim().toUpperCase() : ''
    const NAP_RE = /^NAP[0-9A-F]{8}$/
    let transferCode = NAP_RE.test(clientCode)
      ? clientCode
      : `NAP${crypto.randomBytes(4).toString('hex').toUpperCase()}`

    // Create pending top-up with 30-minute expiry. Retry once with a fresh server-side
    // code if the client code happens to collide with the unique index.
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    let topup
    try {
      topup = await payload.create({
        collection: 'topups',
        data: { user: user.id, amount, transferCode, status: 'pending', expiresAt },
      })
    } catch (createErr) {
      const m = (createErr as Error).message || ''
      if (/unique|duplicate/i.test(m)) {
        transferCode = `NAP${crypto.randomBytes(4).toString('hex').toUpperCase()}`
        topup = await payload.create({
          collection: 'topups',
          data: { user: user.id, amount, transferCode, status: 'pending', expiresAt },
        })
      } else {
        throw createErr
      }
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
