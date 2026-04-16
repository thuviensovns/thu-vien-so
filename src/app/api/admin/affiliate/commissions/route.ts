import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'

/** GET: List affiliate commissions (optionally filtered by referrer email). */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'affiliate.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const sp = req.nextUrl.searchParams
    const referrerEmail = sp.get('referrer_email') || ''
    const limit = Math.min(500, Number(sp.get('limit')) || 200)

    const params: unknown[] = []
    let where = ''
    if (referrerEmail) {
      params.push(`%${referrerEmail}%`)
      where = `WHERE ur.email ILIKE $${params.length}`
    }
    params.push(limit)

    const { rows } = await pool.query(
      `SELECT c.id, c.referrer_user_id, c.referred_user_id, c.source_type, c.source_id,
              c.base_amount, c.commission_amount, c.commission_percent, c.status, c.note,
              c.created_at,
              ur.email AS referrer_email, ur.display_name AS referrer_name,
              ud.email AS referred_email, ud.display_name AS referred_name
       FROM affiliate_commissions c
       LEFT JOIN users ur ON ur.id = c.referrer_user_id
       LEFT JOIN users ud ON ud.id = c.referred_user_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${params.length}`,
      params,
    )
    return NextResponse.json({ docs: rows })
  } catch (error) {
    console.error('[affiliate commissions] GET error:', error)
    return NextResponse.json({ docs: [] })
  }
}
