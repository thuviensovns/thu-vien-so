import { getDbPool } from './db-pool'
import { ensureTablesExist } from './db-migrate'

export interface AffiliateConfig {
  enabled: boolean
  commissionPercent: number
  minWithdrawal: number
  /** Comma-separated source types that accrue commissions; e.g. "topup,order". */
  creditSources: ('topup' | 'order')[]
}

const DEFAULT_CONFIG: AffiliateConfig = {
  enabled: true,
  commissionPercent: 5,
  minWithdrawal: 50_000,
  creditSources: ['topup'],
}

/** Read affiliate config from admin_settings. Falls back to defaults. */
export async function getAffiliateConfig(): Promise<AffiliateConfig> {
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(
      `SELECT value FROM admin_settings WHERE key = 'affiliate_config'`,
    )
    if (rows.length === 0) return DEFAULT_CONFIG
    const raw = rows[0].value as Partial<AffiliateConfig>
    return {
      enabled: !!raw.enabled,
      commissionPercent: Math.max(0, Math.min(50, Number(raw.commissionPercent) || DEFAULT_CONFIG.commissionPercent)),
      minWithdrawal: Math.max(0, Number(raw.minWithdrawal) || DEFAULT_CONFIG.minWithdrawal),
      creditSources: Array.isArray(raw.creditSources) && raw.creditSources.length > 0
        ? (raw.creditSources.filter((s) => s === 'topup' || s === 'order') as ('topup' | 'order')[])
        : DEFAULT_CONFIG.creditSources,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function saveAffiliateConfig(cfg: AffiliateConfig, updatedBy: string): Promise<void> {
  await ensureTablesExist()
  const pool = getDbPool()
  await pool.query(
    `INSERT INTO admin_settings (key, value, updated_by, updated_at)
     VALUES ('affiliate_config', $1::jsonb, $2, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [JSON.stringify(cfg), updatedBy],
  )
}

/** Generate a short, URL-safe ref code. 8 chars base36 timestamp + 4 random chars. */
export function generateRefCode(): string {
  const ts = Date.now().toString(36).slice(-6).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return ts + rand
}

/** Derive a ref code from the email local-part, stripped of @gmail.com / any
 *  domain and non-alphanumerics, uppercased. Returns empty string if the email
 *  would yield nothing usable (e.g. all symbols). Caller must handle that. */
export function refCodeFromEmail(email: string): string {
  if (!email) return ''
  const local = email.split('@')[0] || ''
  const cleaned = local.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned.slice(0, 20)
}

/** Ensure the user has an affiliate_accounts row; creates one if missing.
 *  Prefers an email-derived code (per user request: "mã giới thiệu theo email
 *  đăng ký, bỏ @gmail.com đi"). Falls back to a random code on collision so
 *  two users named e.g. "admin@gmail.com" + "admin@yahoo.com" both succeed. */
export async function ensureAffiliateAccount(userId: number, email?: string): Promise<string> {
  await ensureTablesExist()
  const pool = getDbPool()
  const { rows } = await pool.query(
    `SELECT ref_code FROM affiliate_accounts WHERE user_id = $1`,
    [userId],
  )
  if (rows.length > 0) return rows[0].ref_code

  // Try email-derived code first, then short suffixed variants, then random.
  const emailCode = refCodeFromEmail(email || '')
  const candidates: string[] = []
  if (emailCode) {
    candidates.push(emailCode)
    // short numeric suffix so "JOHN" → "JOHN1", "JOHN2" if already taken
    for (let i = 1; i <= 3; i++) candidates.push(`${emailCode}${i}`)
  }

  for (const code of candidates) {
    try {
      await pool.query(
        `INSERT INTO affiliate_accounts (user_id, ref_code) VALUES ($1, $2)`,
        [userId, code],
      )
      return code
    } catch { /* collision — try next */ }
  }
  // Fallback to random (guarantees termination even if all email variants taken)
  for (let i = 0; i < 5; i++) {
    const code = generateRefCode()
    try {
      await pool.query(
        `INSERT INTO affiliate_accounts (user_id, ref_code) VALUES ($1, $2)`,
        [userId, code],
      )
      return code
    } catch { /* collision — retry */ }
  }
  throw new Error('Không thể tạo mã giới thiệu')
}

/** Attach a referred user to a referrer (one-time, immutable). No-op if already linked or invalid. */
export async function recordReferral(referredUserId: number, refCode: string): Promise<boolean> {
  if (!refCode) return false
  await ensureTablesExist()
  const pool = getDbPool()

  const { rows } = await pool.query(
    `SELECT user_id FROM affiliate_accounts WHERE ref_code = $1`,
    [refCode.toUpperCase()],
  )
  if (rows.length === 0) return false
  const referrerId = rows[0].user_id as number
  if (referrerId === referredUserId) return false // can't self-refer

  try {
    const ins = await pool.query(
      `INSERT INTO affiliate_referrals (referrer_user_id, referred_user_id, ref_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (referred_user_id) DO NOTHING
       RETURNING id`,
      [referrerId, referredUserId, refCode.toUpperCase()],
    )
    // Only bump referral_count when a new referral was actually inserted.
    if ((ins.rowCount ?? 0) > 0) {
      await pool.query(
        `UPDATE affiliate_accounts SET referral_count = referral_count + 1 WHERE user_id = $1`,
        [referrerId],
      )
      return true
    }
    return false
  } catch {
    return false
  }
}

/** Accrue a commission when a referred user performs a billable action (topup/order).
 *
 *  **Auto-credit:** commission is deposited directly into the referrer's
 *  `users.balance` (main wallet, spendable immediately) — no withdrawal step
 *  needed. We also insert a matching `topups` row (transferCode `COMM…`,
 *  readByAdmin=true) so the referrer sees the credit in their topup history
 *  and `affiliate_accounts.auto_credited` so admin stats stay accurate.
 *
 *  The legacy `available_balance` field is *not* touched going forward; any
 *  balance accrued there before this change stays withdrawable via the
 *  existing `/api/affiliate/withdraw` flow.
 *
 *  Returns a `reason` when the commission isn't credited so callers can
 *  surface the outcome to the admin instead of silently losing the credit. */
export async function accrueCommission(opts: {
  referredUserId: number
  baseAmount: number
  sourceType: 'topup' | 'order'
  sourceId?: string
}): Promise<{
  credited: boolean
  amount: number
  reason?: string
  referrerId?: number
  transferCode?: string
}> {
  try {
    const cfg = await getAffiliateConfig()
    if (!cfg.enabled) return { credited: false, amount: 0, reason: 'affiliate_disabled' }
    if (!cfg.creditSources.includes(opts.sourceType)) {
      return { credited: false, amount: 0, reason: `source_${opts.sourceType}_not_credited` }
    }
    if (opts.baseAmount <= 0) return { credited: false, amount: 0, reason: 'zero_base_amount' }

    await ensureTablesExist()
    const pool = getDbPool()

    const { rows } = await pool.query(
      `SELECT referrer_user_id FROM affiliate_referrals WHERE referred_user_id = $1`,
      [opts.referredUserId],
    )
    if (rows.length === 0) return { credited: false, amount: 0, reason: 'user_not_referred' }

    const referrerId = rows[0].referrer_user_id as number
    const commission = Math.floor(opts.baseAmount * (cfg.commissionPercent / 100))
    if (commission <= 0) return { credited: false, amount: 0, reason: 'zero_commission', referrerId }

    // Ensure the referrer has an affiliate_accounts row. Normally
    // `recordReferral` guarantees this, but a legacy row could have been
    // deleted or the backfill skipped a user.
    const { rows: referrerRow } = await pool.query(
      `SELECT 1 FROM affiliate_accounts WHERE user_id = $1`,
      [referrerId],
    )
    if (referrerRow.length === 0) {
      const { rows: userRow } = await pool.query(
        `SELECT email FROM users WHERE id = $1`,
        [referrerId],
      )
      await ensureAffiliateAccount(referrerId, userRow[0]?.email)
    }

    // All four writes must succeed together — otherwise we risk crediting the
    // wallet without logging, or logging without crediting. `ON CONFLICT` on
    // the commission insert still guarantees idempotency across retries.
    const transferCode = `COMM${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const insertResult = await client.query(
        `INSERT INTO affiliate_commissions
           (referrer_user_id, referred_user_id, source_type, source_id, base_amount, commission_amount, commission_percent, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'credited')
         ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          referrerId,
          opts.referredUserId,
          opts.sourceType,
          opts.sourceId || null,
          opts.baseAmount,
          commission,
          cfg.commissionPercent,
        ],
      )
      if ((insertResult.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK')
        return { credited: false, amount: 0, reason: 'already_credited', referrerId }
      }

      const balanceUpdate = await client.query(
        `UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2`,
        [commission, referrerId],
      )
      if ((balanceUpdate.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK')
        return { credited: false, amount: 0, reason: 'referrer_user_missing', referrerId }
      }

      await client.query(
        `UPDATE affiliate_accounts
         SET total_earned = total_earned + $1,
             auto_credited = COALESCE(auto_credited, 0) + $1
         WHERE user_id = $2`,
        [commission, referrerId],
      )

      // Audit topup row so the credit appears in the referrer's topup history.
      // readByAdmin=true so it doesn't flag the admin notifications poll, and
      // bankDescription names the referred user for quick cross-ref.
      await client.query(
        `INSERT INTO topups (user_id, amount, transfer_code, status, confirmed_at, bank_description, read_by_admin, created_at, updated_at)
         VALUES ($1, $2, $3, 'completed', NOW(), $4, true, NOW(), NOW())`,
        [
          referrerId,
          commission,
          transferCode,
          `Hoa hồng ${cfg.commissionPercent}% (${opts.sourceType}#${opts.sourceId || '?'} - user #${opts.referredUserId})`,
        ],
      )

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // Activity log entry so admin sees each commission in /quan-ly/nhat-ky.
    // Outside the transaction — non-critical if it fails.
    try {
      await pool.query(
        `INSERT INTO activity_logs (type, action, detail, admin_email)
         VALUES ('affiliate', $1, $2, 'system')`,
        [
          `Cộng hoa hồng ${opts.sourceType} (auto)`,
          `Referrer #${referrerId} +${commission.toLocaleString('vi-VN')}đ vào ví từ ${opts.sourceType}#${opts.sourceId || '?'} (gốc ${opts.baseAmount.toLocaleString('vi-VN')}đ)`,
        ],
      )
    } catch { /* non-fatal */ }
    return { credited: true, amount: commission, referrerId, transferCode }
  } catch (err) {
    console.error('[affiliate] accrueCommission error:', err)
    return { credited: false, amount: 0, reason: `error:${(err as Error).message}` }
  }
}
