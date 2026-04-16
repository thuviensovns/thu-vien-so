import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'

/** GET /api/balance
 *
 *  Returns the authenticated user's balance. Called every 20s by useBalance()
 *  + on every tab focus/visibility change, so keep it as cheap as possible.
 *
 *  Auth resolves the user id (cookie → users SELECT). A second raw-SQL SELECT
 *  reads just the balance column. This is faster than payload.findByID (which
 *  hydrates the entire user doc + relations).
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pool = getDbPool()
    const { rows } = await pool.query(
      'SELECT balance FROM users WHERE id = $1 LIMIT 1',
      [user.id],
    )
    const balance = Number(rows[0]?.balance || 0)

    const res = NextResponse.json({ balance })
    // Short private cache lets rapid refocus events hit the browser cache,
    // but admin top-ups still land in the UI within ~5s.
    res.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=15')
    return res
  } catch (error) {
    console.error('[Balance] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
