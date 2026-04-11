import { NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/ping
 *
 * Ultra-lightweight liveness probe for the admin status bar. Runs a trivial
 * `SELECT 1` against the shared pg pool — no Payload boot, no session auth,
 * no collection loads. The ping latency the UI shows is therefore a real
 * reflection of Next.js route overhead + DB round-trip, not Payload auth cost.
 */
export async function GET() {
  const start = Date.now()
  try {
    const pool = getDbPool()
    await pool.query('SELECT 1')
    return NextResponse.json(
      { ok: true, dbMs: Date.now() - start },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (error) {
    return NextResponse.json(
      { ok: false, dbMs: Date.now() - start, error: (error as Error).message },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  }
}
