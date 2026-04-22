import { NextRequest, NextResponse } from 'next/server'
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

    // While a top-up is still pending the user is actively waiting.
    // Fire a background Web2M poll (throttled single iteration, no await) so
    // auto-credit keeps up with the bank in near-realtime — independent of
    // the scheduled cron. throttle=3000 coalesces concurrent polls from
    // multiple users watching different pending topups.
    if (topup.status === 'pending' && process.env.CRON_SECRET) {
      const host = req.nextUrl.origin
      const triggerUrl = `${host}/api/cron/poll-web2m?token=${process.env.CRON_SECRET}&throttle=3000`
      fetch(triggerUrl, { cache: 'no-store' }).catch(() => { /* non-blocking */ })
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
