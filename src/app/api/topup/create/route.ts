import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** Create a pending top-up request */
export async function POST(req: NextRequest) {
  let stage = 'init'
  try {
    stage = 'getPayload'
    const payload = await getPayloadForApi()

    stage = 'auth'
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    stage = 'parseBody'
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

    // 3-hour window absorbs Web2M's worst-case API lag (observed up to ~70 min
    // between bank-recorded time and Web2M serving the tx). Previously 30 min,
    // which caused topups to expire mid-cron-lag and forced the auto-create
    // fallback path — leaving the UI polling on a stale transferCode.
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()

    // Upsert: if a pending topup with this fixed code exists, update its amount
    stage = 'findExisting'
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
      stage = 'updateExisting'
      topup = await payload.update({
        collection: 'topups',
        id: existing.docs[0].id,
        data: { amount, expiresAt },
      })
    } else {
      // Create new pending topup
      stage = 'createNew'
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
          stage = 'createFallback'
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

    // Piggy-back a throttled Web2M poll on this same serverless invocation
    // via Next 15 `after()`. If the bank callback landed between the user
    // clicking "đã chuyển khoản" and reaching this line, the credit is
    // applied within ~1s without spawning an extra function invocation.
    // Wrapped in try/catch: `after()` itself can throw at module/runtime
    // level on some Vercel builds and must not block the happy-path response.
    stage = 'after'
    try {
      after(async () => {
        try {
          const { pollWeb2m } = await import('@/lib/web2m-poll')
          await pollWeb2m({ minIntervalMs: 3000 })
        } catch (e) {
          console.warn('[TopUp] after() pollWeb2m failed:', (e as Error)?.message)
        }
      })
    } catch (e) {
      console.warn('[TopUp] after() register failed:', (e as Error)?.message)
    }

    // Kickstart the self-loop chain so polling runs every ~5s until this
    // topup is credited (or expires), without waiting for the next GH Actions
    // cron (≤ 5 min). The fetch is rate-limited by the self-loop's lease —
    // if a chain is already running, this request bails at the lease check
    // without starting a duplicate. No await: the chain runs in its own
    // function container, this response returns immediately.
    stage = 'kickCron'
    if (process.env.CRON_SECRET) {
      try {
        const host = req.nextUrl.origin
        const kickUrl = `${host}/api/cron/poll-web2m?token=${process.env.CRON_SECRET}`
        fetch(kickUrl, { cache: 'no-store' }).catch(() => { /* non-blocking */ })
      } catch (e) {
        console.warn('[TopUp] kickCron failed:', (e as Error)?.message)
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
    const msg = (error as Error)?.message || String(error)
    const stack = (error as Error)?.stack || ''
    console.error(`[TopUp] Create error at stage=${stage}:`, msg, '\n', stack)
    if (msg === 'timeout' || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Service unavailable', stage }, { status: 503 })
    }
    // Expose stage + truncated message so the UI/user can report which step
    // failed. Full stack still only in server logs.
    return NextResponse.json({
      error: 'Internal server error',
      stage,
      detail: msg.slice(0, 300),
    }, { status: 500 })
  }
}
