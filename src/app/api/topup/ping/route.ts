import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'

/**
 * Public topup-poll ping — no auth. Called from the /nap-tien page every ~5s
 * while the QR is visible, so polling runs even before the user clicks
 * "Xác nhận đã chuyển" (many transfer first, click later — or never).
 *
 * Cheap by design:
 *   - in-process per-IP rate limit drops floods before any DB work
 *   - actual Web2M fetch is coalesced by pollWeb2m's atomic 3s throttle
 *     (N concurrent pings → 1 bank fetch)
 *   - after() runs the poll post-response so the client sees ~50ms RTT
 *
 * Not a cron replacement; meant to bridge the gap when users are actively
 * waiting on the page.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 15

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
    return NextResponse.json({ ok: true, throttled: true })
  }

  after(async () => {
    try {
      const { pollWeb2m } = await import('@/lib/web2m-poll')
      await pollWeb2m({ minIntervalMs: 3000 })
    } catch {
      /* non-fatal */
    }
  })

  return NextResponse.json({ ok: true })
}
