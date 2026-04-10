import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'

async function requireAdmin(req: NextRequest) {
  const payload = await getPayloadForApi()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || user.role !== 'admin') return null
  return user
}

/** GET: List activity logs */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensureTablesExist()
    const search = req.nextUrl.searchParams.get('search') || ''
    const type = req.nextUrl.searchParams.get('type') || ''

    const pool = getDbPool()
    let query = `SELECT * FROM activity_logs`
    const conditions: string[] = []
    const params: unknown[] = []

    if (type && type !== 'all') {
      params.push(type)
      conditions.push(`type = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(action ILIKE $${params.length} OR detail ILIKE $${params.length})`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }
    query += ` ORDER BY created_at DESC LIMIT 50`

    const { rows } = await pool.query(query, params)

    return NextResponse.json({
      docs: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        type: r.type,
        action: r.action || '',
        detail: r.detail || '',
        adminEmail: r.admin_email || '',
        timestamp: r.created_at,
      })),
    })
  } catch (error) {
    console.error('[Admin activity-logs] GET error:', error)
    // Table might not exist yet
    return NextResponse.json({ docs: [] })
  }
}

/** POST: Create a new log entry */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
      `INSERT INTO activity_logs (type, action, detail, admin_email) VALUES ($1, $2, $3, $4)`,
      [body.type, body.action, body.detail || '', user.email]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin activity-logs] POST error:', error)
    // Silently fail if table doesn't exist
    return NextResponse.json({ success: true })
  }
}

/** DELETE: Clear all logs */
export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const pool = getDbPool()
    await pool.query(`DELETE FROM activity_logs`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin activity-logs] DELETE error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
