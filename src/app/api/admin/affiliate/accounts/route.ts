import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'

/** GET: List affiliate accounts with totals (optionally filtered by email). */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'affiliate.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const sp = req.nextUrl.searchParams
    const email = sp.get('email') || ''
    const limit = Math.min(200, Number(sp.get('limit')) || 100)

    const params: unknown[] = []
    let where = ''
    if (email) {
      params.push(`%${email}%`)
      where = `WHERE u.email ILIKE $${params.length}`
    }
    params.push(limit)

    const { rows } = await pool.query(
      `SELECT a.user_id, a.ref_code, a.total_earned, a.available_balance, a.withdrawn,
              a.referral_count, a.created_at,
              u.email, u.display_name
       FROM affiliate_accounts a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.total_earned DESC
       LIMIT $${params.length}`,
      params,
    )
    return NextResponse.json({ docs: rows })
  } catch (error) {
    console.error('[affiliate accounts] GET error:', error)
    return NextResponse.json({ docs: [] })
  }
}
