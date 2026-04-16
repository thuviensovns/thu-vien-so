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
  enabled: false,
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

/** Ensure the user has an affiliate_accounts row; creates one if missing. */
export async function ensureAffiliateAccount(userId: number): Promise<string> {
  await ensureTablesExist()
  const pool = getDbPool()
  const { rows } = await pool.query(
    `SELECT ref_code FROM affiliate_accounts WHERE user_id = $1`,
    [userId],
  )
  if (rows.length > 0) return rows[0].ref_code

  // Generate unique code with a few retries on collision
  for (let i = 0; i < 5; i++) {
    const code = generateRefCode()
    try {
      await pool.query(
        `INSERT INTO affiliate_accounts (user_id, ref_code) VALUES ($1, $2)`,
        [userId, code],
      )
      return code
    } catch {
      // collision — retry
    }
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
    await pool.query(
      `INSERT INTO affiliate_referrals (referrer_user_id, referred_user_id, ref_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (referred_user_id) DO NOTHING`,
      [referrerId, referredUserId, refCode.toUpperCase()],
    )
    await pool.query(
      `UPDATE affiliate_accounts SET referral_count = referral_count + 1 WHERE user_id = $1`,
      [referrerId],
    )
    return true
  } catch {
    return false
  }
}

/** Accrue a commission when a referred user performs a billable action (topup/order).
 *  Safe to call from anywhere — silently no-ops if affiliate disabled or user not referred. */
export async function accrueCommission(opts: {
  referredUserId: number
  baseAmount: number
  sourceType: 'topup' | 'order'
  sourceId?: string
}): Promise<{ credited: boolean; amount: number }> {
  try {
    const cfg = await getAffiliateConfig()
    if (!cfg.enabled || !cfg.creditSources.includes(opts.sourceType)) {
      return { credited: false, amount: 0 }
    }
    if (opts.baseAmount <= 0) return { credited: false, amount: 0 }

    await ensureTablesExist()
    const pool = getDbPool()

    const { rows } = await pool.query(
      `SELECT referrer_user_id FROM affiliate_referrals WHERE referred_user_id = $1`,
      [opts.referredUserId],
    )
    if (rows.length === 0) return { credited: false, amount: 0 }

    const referrerId = rows[0].referrer_user_id as number
    const commission = Math.floor(opts.baseAmount * (cfg.commissionPercent / 100))
    if (commission <= 0) return { credited: false, amount: 0 }

    await pool.query(
      `INSERT INTO affiliate_commissions
         (referrer_user_id, referred_user_id, source_type, source_id, base_amount, commission_amount, commission_percent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'credited')`,
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
    await pool.query(
      `UPDATE affiliate_accounts
       SET total_earned = total_earned + $1,
           available_balance = available_balance + $1
       WHERE user_id = $2`,
      [commission, referrerId],
    )
    return { credited: true, amount: commission }
  } catch {
    return { credited: false, amount: 0 }
  }
}
