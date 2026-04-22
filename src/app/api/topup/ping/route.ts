import { NextRequest, NextResponse } from 'next/server'

/**
 * Public topup-poll ping — no auth. Called from the /nap-tien page every ~5s
 * while the QR is visible, so polling runs even before the user clicks
 * "Xác nhận đã chuyển" (many transfer first, click later — or never).
 *
 * Design: fast-return the client in <100ms, then fire-and-forget kickstart
 * the cron self-chain at /api/cron/poll-web2m. The chain has a 60s
 * maxDuration (vs. this endpoint's 10s Hobby default) so Web2M slow-fetches
 * don't cause FUNCTION_INVOCATION_TIMEOUT on the user-facing ping. The
 * chain's own lease ensures only one is running at a time, and recent
 * activity (pending topup OR credit in last 2min) keeps it alive.
 *
 * Not a cron replacement; meant to bridge the gap when users are actively
 * waiting on the page.
 */

export const dynamic = 'force-dynamic'

// Per-IP window: at most 10 pings / 10s. Matches a 1 ping/s ceiling even if
// the client timer drifts or fires bursts after tab-wake.
const LIMIT = 10
const WINDOW_MS = 10_000
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  list.push(now)
  hits.set(ip, list)
  // Occasional GC: if the map grows past ~2k entries, drop stale buckets.
  if (hits.size > 2000) {
    for (const [k, v] of hits) {
      const fresh = v.filter((t) => now - t < WINDOW_MS)
      if (fresh.length === 0) hits.delete(k)
      else hits.set(k, fresh)
    }
  }
  return list.length > LIMIT
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anon'

  if (rateLimited(ip)) {
    return NextResponse.json({ ok: true, throttled: 'rate-limit' })
  }

  // Fire-and-forget kickstart of the cron chain. The chain's DB lease
  // dedupes concurrent kickstarts (only one 55s loop runs at a time), so
  // even 100 pings/min land on the same running loop without stacking.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const kick = `${req.nextUrl.origin}/api/cron/poll-web2m?token=${secret}`
    fetch(kick, { cache: 'no-store' }).catch(() => { /* non-blocking */ })
  }

  return NextResponse.json({ ok: true })
}
