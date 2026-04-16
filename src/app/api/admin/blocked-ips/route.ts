import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'
import { logAdminActivity } from '@/lib/log-activity'

/** GET: List blocked IPs (active + expired). */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'security.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const sp = req.nextUrl.searchParams
    const onlyActive = sp.get('active') === '1'

    const where = onlyActive
      ? `WHERE is_permanent = true OR (blocked_until IS NOT NULL AND blocked_until > NOW())`
      : ''
    const { rows } = await pool.query(
      `SELECT id, ip, reason, attempts_count, blocked_until, is_permanent, blocked_by, created_at
       FROM blocked_ips
       ${where}
       ORDER BY created_at DESC
       LIMIT 500`,
    )
    return NextResponse.json({ docs: rows })
  } catch (error) {
    console.error('[blocked-ips] GET error:', error)
    return NextResponse.json({ docs: [] })
  }
}

/** POST: Manually block an IP (permanent or timed). */
export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, 'security.ip_block_edit')
  if (guard instanceof NextResponse) return guard
  const { user } = guard
  try {
    let body: { ip?: string; reason?: string; hours?: number; is_permanent?: boolean }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const ip = (body.ip || '').trim()
    if (!ip) return NextResponse.json({ error: 'IP là bắt buộc' }, { status: 400 })

    await ensureTablesExist()
    const pool = getDbPool()
    const isPermanent = !!body.is_permanent
    const hours = Math.max(1, Math.min(24 * 365, Number(body.hours) || 24))

    await pool.query(
      `INSERT INTO blocked_ips (ip, reason, attempts_count, blocked_until, is_permanent, blocked_by)
       VALUES ($1, $2, 0, ${isPermanent ? 'NULL' : `NOW() + ($3 * INTERVAL '1 hour')`}, $${isPermanent ? 3 : 4}, $${isPermanent ? 4 : 5})
       ON CONFLICT (ip) DO UPDATE
         SET reason = EXCLUDED.reason,
             blocked_until = EXCLUDED.blocked_until,
             is_permanent = EXCLUDED.is_permanent,
             blocked_by = EXCLUDED.blocked_by`,
      isPermanent
        ? [ip, body.reason || 'Thủ công', true, user.email || 'admin']
        : [ip, body.reason || 'Thủ công', hours, false, user.email || 'admin'],
    )

    await logAdminActivity(req, {
      type: 'security',
      action: 'Chặn IP',
      detail: `${ip} — ${body.reason || 'thủ công'} (${isPermanent ? 'vĩnh viễn' : hours + 'h'})`,
      adminEmail: user.email || 'admin',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

/** DELETE: Unblock an IP (by ip query param) or clear all expired. */
export async function DELETE(req: NextRequest) {
  const guard = await requirePermission(req, 'security.ip_block_edit')
  if (guard instanceof NextResponse) return guard
  const { user } = guard
  try {
    const sp = req.nextUrl.searchParams
    const ip = sp.get('ip')
    const clearExpired = sp.get('clear_expired') === '1'

    await ensureTablesExist()
    const pool = getDbPool()

    if (clearExpired) {
      const res = await pool.query(
        `DELETE FROM blocked_ips WHERE is_permanent = false AND blocked_until IS NOT NULL AND blocked_until <= NOW()`,
      )
      return NextResponse.json({ success: true, removed: res.rowCount })
    }

    if (!ip) return NextResponse.json({ error: 'IP là bắt buộc' }, { status: 400 })
    await pool.query(`DELETE FROM blocked_ips WHERE ip = $1`, [ip])

    await logAdminActivity(req, {
      type: 'security',
      action: 'Bỏ chặn IP',
      detail: ip,
      adminEmail: user.email || 'admin',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
