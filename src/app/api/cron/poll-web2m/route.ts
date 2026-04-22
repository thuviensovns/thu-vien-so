import { NextRequest, NextResponse } from 'next/server'
import { runCronJob } from '@/lib/cron-registry'
import '@/lib/cron-jobs' // side-effect: register jobs

/**
 * Dedicated Vercel Cron target for poll_web2m.
 *
 * Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET`.
 * External schedulers (cron-job.org, UptimeRobot) can use `?token=` query.
 *
 * Behavior: within a single invocation we loop ~every 5 seconds for up to ~55s,
 * so one cron trigger per minute still gives the user near-realtime auto-credit
 * (≤ MIN_INTERVAL_MS from bank-credit to balance-update). Web2M's poll_web2m
 * runner is idempotent (uniques on bank_transaction_id + creditedAt guard on
 * topups), so overlapping polls don't double-credit.
 *
 * vercel.json entry:
 *   { "path": "/api/cron/poll-web2m", "schedule": "* * * * *" }
 */
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MAX_RUNTIME_MS = 55_000 // stay under the 60s function cap
const MIN_INTERVAL_MS = 5_000 // poll every 5s when iterations are faster than that

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || ''
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET chưa cấu hình' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') || ''
  const bearer = auth.replace(/^Bearer\s+/i, '')
  const queryToken = req.nextUrl.searchParams.get('token') || ''

  if (bearer !== secret && queryToken !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Single-shot mode (?once=1) — handy for local testing / manual triggers
  // so we don't waste 55s when all we want is "check right now".
  const once = req.nextUrl.searchParams.get('once') === '1'

  // Throttle mode (?throttle=3000) — when fire-and-forget triggers from topup
  // flows pile up, skip polls that would duplicate a very recent one.
  // Implies once=1 (single check, not 55s loop).
  const throttleMs = Number(req.nextUrl.searchParams.get('throttle') || '0')
  const throttledMode = throttleMs > 0
  if (throttledMode) {
    const { pollWeb2m } = await import('@/lib/web2m-poll')
    const r = await pollWeb2m({ minIntervalMs: throttleMs })
    return NextResponse.json({
      ok: r.ok,
      message: r.message,
      throttled: !!r.throttled,
      credited: r.credited ?? 0,
      total: r.total ?? 0,
    })
  }

  // Piggy-back stale-topup cleanup on every cron cycle — one SQL, fire-and-forget.
  runCronJob('expire_pending_topups').catch(() => { /* non-fatal */ })

  const overallStart = Date.now()
  const iterations: Array<{
    iter: number
    durationMs: number
    ok: boolean
    message: string
    total?: number
    credited?: number
  }> = []

  let totalCredited = 0
  let totalTx = 0

  while (true) {
    const iterStart = Date.now()
    let res: Awaited<ReturnType<typeof runCronJob>>
    try {
      res = await runCronJob('poll_web2m')
    } catch (err) {
      res = {
        ok: false,
        message: `runCronJob threw: ${(err as Error).message}`,
        durationMs: Date.now() - iterStart,
      }
    }
    const durationMs = Date.now() - iterStart
    const resUnknown = res as unknown as { credited?: number; total?: number }
    const credited = typeof resUnknown.credited === 'number' ? resUnknown.credited : 0
    const total = typeof resUnknown.total === 'number' ? resUnknown.total : 0
    totalCredited += credited
    totalTx += total

    iterations.push({
      iter: iterations.length + 1,
      durationMs,
      ok: res.ok !== false,
      message: res.message,
      total,
      credited,
    })

    if (once) break

    const elapsedTotal = Date.now() - overallStart
    const remaining = MAX_RUNTIME_MS - elapsedTotal
    // Need at least one full interval + a safety buffer for the next iteration
    if (remaining < MIN_INTERVAL_MS + 2_000) break

    // Pace the loop to MIN_INTERVAL_MS per iteration (if the poll itself was fast)
    const sleepMs = Math.max(0, MIN_INTERVAL_MS - durationMs)
    if (sleepMs > 0) {
      await new Promise((r) => setTimeout(r, sleepMs))
    }
  }

  return NextResponse.json({
    ok: true,
    iterations: iterations.length,
    totalTx,
    totalCredited,
    elapsedMs: Date.now() - overallStart,
    last: iterations[iterations.length - 1],
  })
}
