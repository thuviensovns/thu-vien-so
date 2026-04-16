import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'
import { logAdminActivity } from '@/lib/log-activity'

/** GET: List campaigns (optionally by status). */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'email.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const sp = req.nextUrl.searchParams
    const status = sp.get('status') || ''

    const params: unknown[] = []
    let where = ''
    if (status && status !== 'all') {
      params.push(status)
      where = `WHERE status = $${params.length}`
    }

    const { rows } = await pool.query(
      `SELECT id, name, subject, recipient_mode, status, total_recipients, sent_count,
              failed_count, created_by, started_at, completed_at, updated_at, created_at
       FROM email_campaigns ${where}
       ORDER BY created_at DESC LIMIT 200`,
      params,
    )
    return NextResponse.json({ docs: rows })
  } catch (error) {
    console.error('[email-campaigns] GET error:', error)
    return NextResponse.json({ docs: [] })
  }
}

/** POST: Create a draft campaign. */
export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, 'email.send')
  if (guard instanceof NextResponse) return guard
  const { user } = guard
  try {
    let body: {
      name?: string
      subject?: string
      html_content?: string
      recipient_mode?: 'all' | 'user_ids'
      recipient_ids?: string
    }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body.name || !body.subject || !body.html_content) {
      return NextResponse.json({ error: 'Tên, tiêu đề, nội dung bắt buộc' }, { status: 400 })
    }
    const mode = body.recipient_mode === 'user_ids' ? 'user_ids' : 'all'

    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(
      `INSERT INTO email_campaigns (name, subject, html_content, recipient_mode, recipient_ids, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6)
       RETURNING id`,
      [body.name, body.subject, body.html_content, mode, body.recipient_ids || null, user.email || 'admin'],
    )

    await logAdminActivity(req, {
      type: 'email',
      action: 'Tạo email campaign',
      detail: body.name,
      adminEmail: user.email || 'admin',
    })

    return NextResponse.json({ success: true, id: rows[0].id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
