import { NextRequest, NextResponse } from 'next/server'
import { runCronJob } from '@/lib/cron-registry'
import { getDbPool } from '@/lib/db-pool'
import '@/lib/cron-jobs' // side-effect: register jobs

/**
 * Dedicated cron target for poll_web2m.
 *
 * Auth: Bearer $CRON_SECRET (GitHub Actions) or ?token=$CRON_SECRET (external).
 *
 * Self-loop: within a single 55s invocation we poll every ~5s. GitHub Actions
 * fires this every 5 min as a baseline. To close the 5-min gap when users are
 * actively waiting, the loop self-chains: at the end of its 55s window, if any
 * topup is still pending, it fire-and-forget fetches itself to start another
 * window. Chain terminates when no pending topups remain (user credited /
 * topup expired). A depth counter caps the chain so a pathological state
 * cannot spin indefinitely — GH cron picks back up after depletion.
 *
 * Idempotency: processBankStatementBatch uses unique(bank_transaction_id) and
 * a creditedAt guard, so overlapping polls never double-credit.
 */
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MAX_RUNTIME_MS = 55_000 // stay under the 60s function cap
const MIN_INTERVAL_MS = 5_000 // poll every 5s when iterations are faster than that
// Chain cap: 11 hops × 55s ≈ 10 minutes max of continuous coverage from a single
// trigger, comfortably bridging GH Actions' 5-min schedule. Rationale for 11:
// pending topups are capped at expiresAt = 30 min from creation, so even an
// always-pending scenario naturally terminates within ~3 chains' worth; 11 is
// a safety ceiling, not a target.
const CHAIN_MAX = 11

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

  // Self-loop lease: only one 55s self-loop instance runs at a time across
  // the whole fleet. Without this, chained invocations can overlap (chain
  // from loop A fires while loop A's response is still in-flight, runner B
  // picks it up, chain from B fires, etc.). The atomic UPDATE here grants
  // exactly one claimant for the 60s window — others bail early. Lease
  // expires naturally so a crashed loop can't deadlock polling.
  //
  // `once=1` single-shot calls skip the lease entirely: they're meant for
  // admin / scripted quick-checks and should never block the regular chain.
  const loopPool = getDbPool()
  if (!once) {
    const lease = await loopPool.query(
      `UPDATE bank_config
          SET web2m_loop_lease_until = NOW() + INTERVAL '60 seconds'
        WHERE web2m_loop_lease_until IS NULL
           OR web2m_loop_lease_until < NOW()
        RETURNING id`,
    )
    if (lease.rowCount === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: 'another self-loop is active — skipping to avoid parallel polling',
      })
    }
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

  // Self-chain: if any topup is still pending, fire-and-forget another
  // invocation so polling continues seamlessly past this 55s window. The
  // new invocation runs in its own function container — this one returns
  // immediately. chain=N decrements per hop; GH Actions initiates chains
  // with chain=CHAIN_MAX, admin once=1 never chains.
  //
  // Release our lease first so the next hop's atomic claim succeeds without
  // waiting up to 60s for the old lease to expire. If we're not chaining,
  // releasing is still correct — a fresh GH cron trigger or admin dispatch
  // should be able to start immediately.
  let chained = false
  const chainIn = Number(req.nextUrl.searchParams.get('chain') || String(CHAIN_MAX))
  if (!once) {
    try {
      if (chainIn > 0) {
        // Keep the chain alive whenever there's any signal of active use:
        //   (a) a pending topup awaiting credit, or
        //   (b) a recent credit (last 2 min) — users often queue multiple
        //       transfers back-to-back, and we'd rather overspend a few
        //       chain hops than drop the next one on the floor.
        // Not using web2m_last_poll_at as a signal: the chain's own polls
        // bump it, so (c) "recent poll" would self-perpetuate. Users
        // actively watching /nap-tien drive polling directly via the
        // /api/topup/ping loop (fires pollWeb2m via after() every ~5s).
        const activity = await loopPool.query(
          `SELECT
             EXISTS(SELECT 1 FROM topups
                     WHERE status = 'pending' AND expires_at > NOW()) AS has_pending,
             EXISTS(SELECT 1 FROM topups
                     WHERE status = 'completed'
                       AND confirmed_at > NOW() - INTERVAL '2 minutes') AS recent_credit`,
        )
        const row = activity.rows[0] as { has_pending: boolean; recent_credit: boolean }
        const keepAlive = row?.has_pending || row?.recent_credit
        if (keepAlive) {
          await loopPool.query(`UPDATE bank_config SET web2m_loop_lease_until = NULL`)
          const nextUrl = `${req.nextUrl.origin}/api/cron/poll-web2m?token=${secret}&chain=${chainIn - 1}`
          fetch(nextUrl, { cache: 'no-store' }).catch(() => { /* non-blocking */ })
          chained = true
        }
      }
      if (!chained) {
        await loopPool.query(`UPDATE bank_config SET web2m_loop_lease_until = NULL`)
      }
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    ok: true,
    iterations: iterations.length,
    totalTx,
    totalCredited,
    elapsedMs: Date.now() - overallStart,
    chained,
    chainRemaining: chained ? chainIn - 1 : 0,
    last: iterations[iterations.length - 1],
  })
}
