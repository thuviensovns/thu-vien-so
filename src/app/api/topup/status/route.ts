import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** Check top-up status by transferCode */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const transferCode = req.nextUrl.searchParams.get('code')
    if (!transferCode) {
      return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 })
    }

    const result = await payload.find({
      collection: 'topups',
      where: {
        transferCode: { equals: transferCode },
        user: { equals: user.id },
      },
      limit: 1,
    })

    if (result.totalDocs === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const topup = result.docs[0]

    // While a topup is pending the user is actively waiting. Piggy-back a
    // Web2M poll on this request using Next 15 `after()` — the handler
    // returns immediately to the client, then the poll runs in the SAME
    // serverless invocation before container freeze. This avoids the extra
    // fetch-to-self function call that would double our Vercel invocation
    // count (the client polls /status every 5s; on Hobby plan that adds up
    // fast). The atomic throttle inside pollWeb2m coalesces concurrent users.
    if (topup.status === 'pending') {
      after(async () => {
        try {
          const { pollWeb2m } = await import('@/lib/web2m-poll')
          await pollWeb2m({ minIntervalMs: 3000 })
        } catch { /* non-fatal */ }
      })
    }

    return NextResponse.json({
      id: topup.id,
      status: topup.status,
      amount: topup.amount,
      transferCode: topup.transferCode,
      confirmedAt: topup.confirmedAt,
    })
  } catch (error) {
    console.error('[TopUp] Status check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
