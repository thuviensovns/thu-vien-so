import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'
import { logAdminActivity } from '@/lib/log-activity'

/** GET: List withdrawal requests (optionally by status). */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'affiliate.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const sp = req.nextUrl.searchParams
    const status = sp.get('status') || ''
    const limit = Math.min(500, Number(sp.get('limit')) || 200)

    const params: unknown[] = []
    let where = ''
    if (status && status !== 'all') {
      params.push(status)
      where = `WHERE w.status = $${params.length}`
    }
    params.push(limit)

    const { rows } = await pool.query(
      `SELECT w.id, w.user_id, w.amount, w.bank_name, w.bank_account_number, w.bank_account_holder,
              w.status, w.admin_note, w.processed_by, w.processed_at, w.created_at,
              u.email, u.display_name
       FROM affiliate_withdrawals w
       LEFT JOIN users u ON u.id = w.user_id
       ${where}
       ORDER BY w.created_at DESC
       LIMIT $${params.length}`,
      params,
    )
    return NextResponse.json({ docs: rows })
  } catch (error) {
    console.error('[affiliate withdrawals] GET error:', error)
    return NextResponse.json({ docs: [] })
  }
}

/** PATCH: Approve or reject a withdrawal. Body: { id, status: 'approved'|'rejected', admin_note? } */
export async function PATCH(req: NextRequest) {
  const guard = await requirePermission(req, 'affiliate.withdraw_approve')
  if (guard instanceof NextResponse) return guard
  const { user } = guard
  try {
    let body: { id?: number; status?: string; admin_note?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body.id || !body.status) {
      return NextResponse.json({ error: 'id + status bắt buộc' }, { status: 400 })
    }
    if (!['approved', 'rejected', 'pending'].includes(body.status)) {
      return NextResponse.json({ error: 'Status không hợp lệ' }, { status: 400 })
    }

    const pool = getDbPool()
    const { rows: existing } = await pool.query(
      `SELECT id, user_id, amount, status FROM affiliate_withdrawals WHERE id = $1`,
      [body.id],
    )
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    }
    const row = existing[0]
    if (row.status !== 'pending' && body.status !== 'pending') {
      return NextResponse.json({ error: 'Chỉ duyệt/từ chối yêu cầu đang pending' }, { status: 400 })
    }

    // If rejecting → refund available_balance. If approving → mark as withdrawn.
    if (body.status === 'rejected') {
      await pool.query(
        `UPDATE affiliate_accounts
         SET available_balance = available_balance + $1
         WHERE user_id = $2`,
        [row.amount, row.user_id],
      )
    } else if (body.status === 'approved') {
      await pool.query(
        `UPDATE affiliate_accounts
         SET withdrawn = withdrawn + $1
         WHERE user_id = $2`,
        [row.amount, row.user_id],
      )
    }

    await pool.query(
      `UPDATE affiliate_withdrawals
       SET status = $1, admin_note = $2, processed_by = $3, processed_at = NOW()
       WHERE id = $4`,
      [body.status, body.admin_note || null, user.email || 'admin', body.id],
    )

    await logAdminActivity(req, {
      type: 'affiliate',
      action: `Rút tiền affiliate: ${body.status}`,
      detail: `user ${row.user_id} — ${row.amount}đ${body.admin_note ? ` — ${body.admin_note}` : ''}`,
      adminEmail: user.email || 'admin',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
