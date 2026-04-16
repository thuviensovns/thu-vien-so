import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { getAuthorizedUser, requirePermission } from '@/lib/authz'
import { getClientIp, getUserAgent } from '@/lib/request-meta'

/** GET: List activity logs with filters */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'logs.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const sp = req.nextUrl.searchParams
    const search = sp.get('search') || ''
    const type = sp.get('type') || ''
    const adminEmail = sp.get('admin_email') || ''
    const ip = sp.get('ip') || ''
    const dateFrom = sp.get('date_from') || ''
    const dateTo = sp.get('date_to') || ''
    const limit = Math.min(200, Number(sp.get('limit')) || 100)

    const pool = getDbPool()
    let query = `SELECT * FROM activity_logs`
    const conditions: string[] = []
    const params: unknown[] = []

    if (type && type !== 'all') {
      params.push(type)
      conditions.push(`type = $${params.length}`)
    }
    if (adminEmail) {
      params.push(`%${adminEmail}%`)
      conditions.push(`admin_email ILIKE $${params.length}`)
    }
    if (ip) {
      params.push(`%${ip}%`)
      conditions.push(`ip ILIKE $${params.length}`)
    }
    if (dateFrom) {
      params.push(dateFrom)
      conditions.push(`created_at >= $${params.length}`)
    }
    if (dateTo) {
      params.push(dateTo)
      conditions.push(`created_at <= $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(action ILIKE $${params.length} OR detail ILIKE $${params.length})`)
    }

    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`
    params.push(limit)
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`

    const { rows } = await pool.query(query, params)
    return NextResponse.json({
      docs: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        type: r.type,
        action: r.action || '',
        detail: r.detail || '',
        adminEmail: r.admin_email || '',
        ip: r.ip || '',
        userAgent: r.user_agent || '',
        timestamp: r.created_at,
      })),
    })
  } catch (error) {
    console.error('[Admin activity-logs] GET error:', error)
    return NextResponse.json({ docs: [] })
  }
}

/** POST: Create a new log entry (authenticated user required) */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: { type?: string; action?: string; detail?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body.type || !body.action) {
      return NextResponse.json({ error: 'Missing type or action' }, { status: 400 })
    }

    await ensureTablesExist()
    const pool = getDbPool()
    await pool.query(
      `INSERT INTO activity_logs (type, action, detail, admin_email, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [body.type, body.action, body.detail || '', user.email, getClientIp(req), getUserAgent(req)],
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin activity-logs] POST error:', error)
    return NextResponse.json({ success: true })
  }
}

/** DELETE: Clear all logs (permission: logs.delete) */
export async function DELETE(req: NextRequest) {
  const guard = await requirePermission(req, 'logs.delete')
  if (guard instanceof NextResponse) return guard
  try {
    const pool = getDbPool()
    await pool.query(`DELETE FROM activity_logs`)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
