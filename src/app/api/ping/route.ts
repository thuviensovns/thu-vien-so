import { neon } from '@neondatabase/serverless'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * GET /api/ping
 *
 * Ultra-lightweight liveness probe for the admin status bar and the GitHub
 * Actions keepalive cron. Runs a trivial `SELECT 1` via Neon's HTTP driver
 * on the Edge runtime — no Payload boot, no pg pool init, no SSL handshake
 * per request (HTTP/2 connection reuse). Cold start ~10ms vs ~500ms on Node.
 *
 * Neon HTTP driver reuses the same DATABASE_URL but tunnels queries over
 * HTTPS, which avoids the TCP+SSL handshake that pg pays on every cold
 * function instance.
 */
const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  const start = Date.now()
  try {
    await sql`SELECT 1`
    return Response.json(
      { ok: true, dbMs: Date.now() - start },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (error) {
    return Response.json(
      { ok: false, dbMs: Date.now() - start, error: (error as Error).message },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  }
}
