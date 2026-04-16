import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { requirePermission } from '@/lib/authz'
import { logAdminActivity } from '@/lib/log-activity'

type Ctx = { params: Promise<{ id: string }> }

/** GET: Single campaign with full html_content + queue summary. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission(req, 'email.view')
  if (guard instanceof NextResponse) return guard
  try {
    const { id } = await ctx.params
    const pool = getDbPool()
    const { rows } = await pool.query(
      `SELECT * FROM email_campaigns WHERE id = $1`,
      [Number(id)],
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

/** PATCH: Edit draft fields. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission(req, 'email.send')
  if (guard instanceof NextResponse) return guard
  try {
    const { id } = await ctx.params
    let body: {
      name?: string; subject?: string; html_content?: string
      recipient_mode?: 'all' | 'user_ids'; recipient_ids?: string
    }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const pool = getDbPool()
    const { rows: existing } = await pool.query(
      `SELECT status FROM email_campaigns WHERE id = $1`,
      [Number(id)],
    )
    if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing[0].status !== 'draft') {
      return NextResponse.json({ error: 'Chỉ chỉnh sửa được campaign ở trạng thái draft' }, { status: 400 })
    }

    await pool.query(
      `UPDATE email_campaigns
       SET name = COALESCE($1, name),
           subject = COALESCE($2, subject),
           html_content = COALESCE($3, html_content),
           recipient_mode = COALESCE($4, recipient_mode),
           recipient_ids = COALESCE($5, recipient_ids),
           updated_at = NOW()
       WHERE id = $6`,
      [body.name || null, body.subject || null, body.html_content || null,
       body.recipient_mode || null, body.recipient_ids || null, Number(id)],
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

/** DELETE: Drop campaign + queue items. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission(req, 'email.send')
  if (guard instanceof NextResponse) return guard
  const { user } = guard
  try {
    const { id } = await ctx.params
    const pool = getDbPool()
    await pool.query(`DELETE FROM email_campaigns WHERE id = $1`, [Number(id)])
    await logAdminActivity(req, {
      type: 'email',
      action: 'Xóa campaign',
      detail: `id=${id}`,
      adminEmail: user.email || 'admin',
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
