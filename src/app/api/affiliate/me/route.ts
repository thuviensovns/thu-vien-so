import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { getAuthorizedUser } from '@/lib/authz'
import { ensureAffiliateAccount, getAffiliateConfig } from '@/lib/affiliate'

/** GET: Return the current user's affiliate account + recent commissions. */
export async function GET(req: NextRequest) {
  const user = await getAuthorizedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const cfg = await getAffiliateConfig()
    if (!cfg.enabled) {
      return NextResponse.json({ enabled: false, config: cfg })
    }

    const refCode = await ensureAffiliateAccount(Number(user.id))
    await ensureTablesExist()
    const pool = getDbPool()

    const [acctRes, commRes] = await Promise.all([
      pool.query(
        `SELECT total_earned, available_balance, withdrawn, referral_count
         FROM affiliate_accounts WHERE user_id = $1`,
        [user.id],
      ),
      pool.query(
        `SELECT c.id, c.source_type, c.base_amount, c.commission_amount, c.commission_percent,
                c.status, c.created_at, ud.email AS referred_email
         FROM affiliate_commissions c
         LEFT JOIN users ud ON ud.id = c.referred_user_id
         WHERE c.referrer_user_id = $1
         ORDER BY c.created_at DESC
         LIMIT 30`,
        [user.id],
      ),
    ])

    return NextResponse.json({
      enabled: true,
      config: cfg,
      refCode,
      account: acctRes.rows[0] || {
        total_earned: 0, available_balance: 0, withdrawn: 0, referral_count: 0,
      },
      commissions: commRes.rows,
    })
  } catch (error) {
    console.error('[affiliate/me] error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
