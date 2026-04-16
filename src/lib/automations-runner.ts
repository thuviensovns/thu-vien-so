import { getDbPool } from './db-pool'
import { ensureTablesExist } from './db-migrate'

/** Automation rule row (maps to automations table DDL in db-migrate.ts).
 *  type + config JSONB encode the behavior; see executeRule() for supported types. */
interface AutomationRule {
  id: number
  name: string
  type: string
  config: Record<string, unknown> | null
}

/** Run all enabled automation rules in sequence. Returns tick stats. */
export async function runAutomations(): Promise<{ executed: number; errors: number }> {
  await ensureTablesExist()
  const pool = getDbPool()

  const { rows } = await pool.query(
    `SELECT id, name, type, config FROM automations WHERE enabled = true`,
  )
  if (rows.length === 0) return { executed: 0, errors: 0 }

  let executed = 0
  let errors = 0
  for (const rule of rows as AutomationRule[]) {
    try {
      const affected = await executeRule(rule)
      await pool.query(
        `UPDATE automations
         SET last_run_at = NOW(),
             last_status = 'ok',
             last_affected_count = $1,
             last_error = NULL,
             run_count = COALESCE(run_count, 0) + 1,
             updated_at = NOW()
         WHERE id = $2`,
        [affected, rule.id],
      )
      executed++
    } catch (err) {
      errors++
      await pool.query(
        `UPDATE automations
         SET last_run_at = NOW(),
             last_status = 'error',
             last_error = $1,
             run_count = COALESCE(run_count, 0) + 1,
             updated_at = NOW()
         WHERE id = $2`,
        [((err as Error).message || 'Error').slice(0, 1000), rule.id],
      )
    }
  }

  return { executed, errors }
}

async function executeRule(rule: AutomationRule): Promise<number> {
  const pool = getDbPool()
  const cfg = rule.config || {}

  switch (rule.type) {
    case 'cancel_stale_orders': {
      // config: { hours: 2 } — auto-cancel pending orders older than N hours
      const hours = Math.max(1, Number(cfg.hours) || 2)
      const res = await pool.query(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW()
         WHERE status = 'pending' AND created_at < NOW() - ($1 * INTERVAL '1 hour')`,
        [hours],
      )
      return res.rowCount || 0
    }

    case 'remind_unpaid_orders': {
      // config: { hours: 1 } — queue a system reminder email for unpaid orders N hours old.
      // Uses source_key = 'reminder_order_<id>' with a unique index so the same order is
      // never reminded twice. processEmailQueue() falls back to a built-in template when
      // campaign_id is NULL and source_key matches this pattern.
      const hours = Math.max(1, Number(cfg.hours) || 1)
      const res = await pool.query(
        `INSERT INTO email_queue (campaign_id, user_id, recipient_email, source_key, status)
         SELECT NULL, u.id, u.email, 'reminder_order_' || o.id, 'pending'
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE o.status = 'pending'
           AND o.created_at < NOW() - ($1 * INTERVAL '1 hour')
           AND o.created_at > NOW() - INTERVAL '7 days'
           AND u.email IS NOT NULL
         ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO NOTHING`,
        [hours],
      )
      return res.rowCount || 0
    }

    case 'purge_old_logs': {
      // config: { days: 180 }
      const days = Math.max(7, Number(cfg.days) || 180)
      const res = await pool.query(
        `DELETE FROM activity_logs WHERE created_at < NOW() - ($1 * INTERVAL '1 day')`,
        [days],
      )
      return res.rowCount || 0
    }

    default:
      throw new Error(`Loại automation không hỗ trợ: ${rule.type}`)
  }
}
