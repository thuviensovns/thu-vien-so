import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'

/** GET: List failed login attempts (optionally filtered by ip or email). */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'security.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const sp = req.nextUrl.searchParams
    const ip = sp.get('ip') || ''
    const email = sp.get('email') || ''
    const limit = Math.min(500, Number(sp.get('limit')) || 200)

    const conditions: string[] = []
    const params: unknown[] = []
    if (ip) { params.push(`%${ip}%`); conditions.push(`ip ILIKE $${params.length}`) }
    if (email) { params.push(`%${email}%`); conditions.push(`email ILIKE $${params.length}`) }
    params.push(limit)

    const { rows } = await pool.query(
      `SELECT id, ip, email, type, reason, user_agent, created_at
       FROM failed_login_attempts
       ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    )
    return NextResponse.json({ docs: rows })
  } catch (error) {
    console.error('[failed-attempts] GET error:', error)
    return NextResponse.json({ docs: [] })
  }
}

/** DELETE: Clear failed attempts (optionally scoped by ip or older-than hours). */
export async function DELETE(req: NextRequest) {
  const guard = await requirePermission(req, 'security.ip_block_edit')
  if (guard instanceof NextResponse) return guard
  try {
    const sp = req.nextUrl.searchParams
    const ip = sp.get('ip')
    const olderThanHours = Number(sp.get('older_than_hours'))

    const pool = getDbPool()
    if (ip) {
      await pool.query(`DELETE FROM failed_login_attempts WHERE ip = $1`, [ip])
    } else if (olderThanHours > 0) {
      await pool.query(
        `DELETE FROM failed_login_attempts WHERE created_at < NOW() - ($1 * INTERVAL '1 hour')`,
        [olderThanHours],
      )
    } else {
      await pool.query(`DELETE FROM failed_login_attempts`)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
