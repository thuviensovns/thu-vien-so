import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'
import { logAdminActivity } from '@/lib/log-activity'

const ALLOWED_TYPES = ['cancel_stale_orders', 'remind_unpaid_orders', 'purge_old_logs']

/** GET: List all automations. */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'automations.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(
      `SELECT id, name, type, config, enabled, last_run_at, last_status, last_affected_count,
              last_error, run_count, updated_at, created_at
       FROM automations
       ORDER BY created_at DESC`,
    )
    return NextResponse.json({
      docs: rows,
      allowedTypes: ALLOWED_TYPES,
    })
  } catch (error) {
    console.error('[automations] GET error:', error)
    return NextResponse.json({ docs: [] })
  }
}

/** POST: Create a new automation. */
export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, 'automations.edit')
  if (guard instanceof NextResponse) return guard
  const { user } = guard
  try {
    let body: { name?: string; type?: string; config?: Record<string, unknown>; enabled?: boolean }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body.name || !body.type) {
      return NextResponse.json({ error: 'Tên + loại là bắt buộc' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(body.type)) {
      return NextResponse.json({ error: `Loại không hợp lệ: ${body.type}` }, { status: 400 })
    }

    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(
      `INSERT INTO automations (name, type, config, enabled)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING id`,
      [body.name, body.type, JSON.stringify(body.config || {}), body.enabled !== false],
    )
    await logAdminActivity(req, {
      type: 'automation',
      action: 'Tạo automation',
      detail: `${body.name} (${body.type})`,
      adminEmail: user.email || 'admin',
    })
    return NextResponse.json({ success: true, id: rows[0].id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
