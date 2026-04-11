import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'

export const dynamic = 'force-dynamic'

/**
 * POST /api/coupons/consume  { id } or { code }
 *
 * Atomically increment `used_count` on a coupon row. Caller must be an
 * authenticated user (customer or admin) so anonymous clients can't burn
 * down usage counts. Re-validates max_uses inside the UPDATE so that a
 * race between two concurrent payments can't overshoot the limit.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { id?: number | string; code?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    await ensureTablesExist()
    const pool = getDbPool()

    let result
    if (body.id) {
      result = await pool.query(
        `UPDATE coupons
         SET used_count = used_count + 1, updated_at = NOW()
         WHERE id = $1 AND active = true
           AND (max_uses = 0 OR used_count < max_uses)
         RETURNING id, used_count`,
        [Number(body.id)]
      )
    } else if (body.code) {
      const code = String(body.code).trim().toUpperCase()
      if (!code || code.length > 50 || /[<>"'`;]/.test(code)) {
        return NextResponse.json({ error: 'Mã không hợp lệ' }, { status: 400 })
      }
      result = await pool.query(
        `UPDATE coupons
         SET used_count = used_count + 1, updated_at = NOW()
         WHERE UPPER(code) = $1 AND active = true
           AND (max_uses = 0 OR used_count < max_uses)
         RETURNING id, used_count`,
        [code]
      )
    } else {
      return NextResponse.json({ error: 'Missing id or code' }, { status: 400 })
    }

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Mã không còn sử dụng được' }, { status: 410 })
    }
    return NextResponse.json({ success: true, usedCount: Number(result.rows[0].used_count) })
  } catch (error) {
    console.error('[coupons/consume] error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
