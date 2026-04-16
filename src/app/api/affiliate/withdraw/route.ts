import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { getAuthorizedUser } from '@/lib/authz'
import { getAffiliateConfig } from '@/lib/affiliate'
import { logAdminActivity } from '@/lib/log-activity'

/** POST: User requests a withdrawal. Body: { amount, bank_name, bank_account_number, bank_account_holder }. */
export async function POST(req: NextRequest) {
  const user = await getAuthorizedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const cfg = await getAffiliateConfig()
    if (!cfg.enabled) return NextResponse.json({ error: 'Affiliate hiện tạm khoá' }, { status: 403 })

    let body: {
      amount?: number
      bank_name?: string
      bank_account_number?: string
      bank_account_holder?: string
    }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const amount = Math.floor(Number(body.amount) || 0)
    if (amount < cfg.minWithdrawal) {
      return NextResponse.json(
        { error: `Số tiền tối thiểu là ${cfg.minWithdrawal.toLocaleString('vi-VN')}đ` },
        { status: 400 },
      )
    }
    if (!body.bank_name || !body.bank_account_number || !body.bank_account_holder) {
      return NextResponse.json({ error: 'Thông tin ngân hàng là bắt buộc' }, { status: 400 })
    }

    await ensureTablesExist()
    const pool = getDbPool()

    // Atomic check + debit available_balance
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `SELECT available_balance FROM affiliate_accounts WHERE user_id = $1 FOR UPDATE`,
        [user.id],
      )
      if (rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Chưa có tài khoản affiliate' }, { status: 400 })
      }
      const bal = Number(rows[0].available_balance)
      if (bal < amount) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Số dư không đủ' }, { status: 400 })
      }

      await client.query(
        `UPDATE affiliate_accounts SET available_balance = available_balance - $1 WHERE user_id = $2`,
        [amount, user.id],
      )
      const { rows: inserted } = await client.query(
        `INSERT INTO affiliate_withdrawals
           (user_id, amount, bank_name, bank_account_number, bank_account_holder, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id`,
        [user.id, amount, body.bank_name, body.bank_account_number, body.bank_account_holder],
      )
      await client.query('COMMIT')
      // Notify admin via activity log — surfaced in /quan-ly/nhat-ky and
      // drives the pending-withdraw badge queried in /api/notifications.
      await logAdminActivity(req, {
        type: 'affiliate',
        action: 'Yêu cầu rút tiền affiliate',
        detail: `${user.email} — ${amount.toLocaleString('vi-VN')}đ — ${body.bank_name}/${body.bank_account_number}`,
        adminEmail: 'system',
      })
      return NextResponse.json({ success: true, id: inserted[0].id })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
