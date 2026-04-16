import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'
import { logAdminActivity } from '@/lib/log-activity'

type Ctx = { params: Promise<{ id: string }> }

/** POST: Enqueue the campaign for sending.
 *  Actual sending happens via the `send_email_queue` cron job (or manual run). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission(req, 'email.send')
  if (guard instanceof NextResponse) return guard
  const { user } = guard
  try {
    const { id } = await ctx.params
    await ensureTablesExist()
    const pool = getDbPool()

    const { rows } = await pool.query(
      `SELECT id, name, status, recipient_mode, recipient_ids FROM email_campaigns WHERE id = $1`,
      [Number(id)],
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const c = rows[0]
    if (c.status !== 'draft') {
      return NextResponse.json({ error: `Campaign ở trạng thái ${c.status}, không thể gửi lại` }, { status: 400 })
    }

    // Build recipient list
    let queueInsert: { rowCount: number | null }
    if (c.recipient_mode === 'user_ids' && c.recipient_ids) {
      const ids = c.recipient_ids.split(',').map((s: string) => Number(s.trim())).filter(Boolean)
      if (ids.length === 0) {
        return NextResponse.json({ error: 'Không có user_id hợp lệ' }, { status: 400 })
      }
      queueInsert = await pool.query(
        `INSERT INTO email_queue (campaign_id, user_id, recipient_email, status)
         SELECT $1, u.id, u.email, 'pending'
         FROM users u WHERE u.id = ANY($2::int[]) AND u.email IS NOT NULL`,
        [c.id, ids],
      )
    } else {
      // recipient_mode = 'all' — every user with an email
      queueInsert = await pool.query(
        `INSERT INTO email_queue (campaign_id, user_id, recipient_email, status)
         SELECT $1, u.id, u.email, 'pending'
         FROM users u WHERE u.email IS NOT NULL`,
        [c.id],
      )
    }

    const totalQueued = queueInsert.rowCount || 0
    await pool.query(
      `UPDATE email_campaigns
       SET status = 'sending', total_recipients = $1, started_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [totalQueued, c.id],
    )

    await logAdminActivity(req, {
      type: 'email',
      action: 'Gửi email campaign',
      detail: `${c.name} — queued ${totalQueued} recipients`,
      adminEmail: user.email || 'admin',
    })

    // Best-effort: trigger the queue immediately (ignored errors — cron will pick it up).
    try {
      const { processEmailQueue } = await import('@/lib/email-sender')
      processEmailQueue().catch(() => {})
    } catch { /* SMTP not configured yet — cron run will surface the error */ }

    return NextResponse.json({ success: true, queued: totalQueued })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
