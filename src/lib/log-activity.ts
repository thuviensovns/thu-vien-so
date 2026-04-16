import type { NextRequest } from 'next/server'
import { getDbPool } from './db-pool'
import { ensureTablesExist } from './db-migrate'
import { getClientIp, getUserAgent } from './request-meta'

export type LogType = 'order' | 'user' | 'topup' | 'coupon' | 'product' | 'settings' | 'system' | 'role' | 'affiliate' | 'email' | 'automation' | 'security' | 'cron'

/** Server-side activity logger. Safe to call from any API route.
 *  Fails silently on error — logs must never block business logic. */
export async function logAdminActivity(
  req: NextRequest | Request,
  opts: { type: LogType; action: string; detail?: string; adminEmail: string },
): Promise<void> {
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    await pool.query(
      `INSERT INTO activity_logs (type, action, detail, admin_email, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        opts.type,
        opts.action,
        opts.detail || '',
        opts.adminEmail,
        getClientIp(req),
        getUserAgent(req),
      ],
    )
  } catch (err) {
    console.warn('[logAdminActivity] failed:', (err as Error).message)
  }
}
