import type { NextRequest } from 'next/server'
import { getDbPool } from './db-pool'
import { ensureTablesExist } from './db-migrate'
import { getClientIp, getUserAgent } from './request-meta'

/** Configurable thresholds. Future: move to admin_settings. */
export const FAILED_LOGIN_LIMIT = 10 // attempts
export const FAILED_LOGIN_WINDOW_MIN = 15 // minutes
export const AUTO_BLOCK_DURATION_HOURS = 24

/** Returns true if the IP is currently blocked (permanent, or blocked_until > now). */
export async function isIpBlocked(ip: string): Promise<{ blocked: boolean; reason?: string; until?: string | null }> {
  if (!ip || ip === 'unknown') return { blocked: false }
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(
      `SELECT ip, reason, blocked_until, is_permanent
       FROM blocked_ips
       WHERE ip = $1
         AND (is_permanent = true OR (blocked_until IS NOT NULL AND blocked_until > NOW()))`,
      [ip],
    )
    if (rows.length === 0) return { blocked: false }
    return {
      blocked: true,
      reason: rows[0].reason || undefined,
      until: rows[0].is_permanent ? null : rows[0].blocked_until,
    }
  } catch {
    return { blocked: false }
  }
}

/** Record a failed authentication attempt; auto-block when threshold reached. */
export async function recordFailedAttempt(
  req: NextRequest | Request,
  opts: { email?: string; type?: 'login' | 'admin' | 'reset_password'; reason?: string },
): Promise<{ attempts: number; blocked: boolean }> {
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const ip = getClientIp(req)
    const ua = getUserAgent(req)

    await pool.query(
      `INSERT INTO failed_login_attempts (ip, email, type, reason, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [ip, opts.email || null, opts.type || 'login', opts.reason || null, ua],
    )

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM failed_login_attempts
       WHERE ip = $1 AND created_at > NOW() - ($2 * INTERVAL '1 minute')`,
      [ip, FAILED_LOGIN_WINDOW_MIN],
    )
    const attempts = countRes.rows[0].cnt

    if (attempts >= FAILED_LOGIN_LIMIT) {
      await pool.query(
        `INSERT INTO blocked_ips (ip, reason, attempts_count, blocked_until, is_permanent, blocked_by)
         VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 hour'), false, 'auto')
         ON CONFLICT (ip) DO UPDATE
           SET attempts_count = EXCLUDED.attempts_count,
               blocked_until = EXCLUDED.blocked_until,
               reason = EXCLUDED.reason`,
        [ip, `Auto-block: ${attempts} đăng nhập thất bại`, attempts, AUTO_BLOCK_DURATION_HOURS],
      )
      return { attempts, blocked: true }
    }
    return { attempts, blocked: false }
  } catch (err) {
    console.warn('[recordFailedAttempt] error:', (err as Error).message)
    return { attempts: 0, blocked: false }
  }
}

/** Clear failed attempts for IP on successful login. */
export async function clearFailedAttempts(ip: string): Promise<void> {
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    await pool.query(`DELETE FROM failed_login_attempts WHERE ip = $1`, [ip])
  } catch { /* ignore */ }
}
