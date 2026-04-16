import { getDbPool } from './db-pool'
import { ensureTablesExist } from './db-migrate'

export type CronHandler = () => Promise<{ message?: string; [k: string]: unknown } | void>

export interface CronJobDef {
  key: string
  name: string
  description: string
  /** Recommended interval hint, e.g. '5m', '1h', '24h'. */
  recommendedInterval: string
  handler: CronHandler
}

const jobs = new Map<string, CronJobDef>()

/** Register a cron job at module import. Subsequent calls overwrite. */
export function registerCron(def: CronJobDef): void {
  jobs.set(def.key, def)
}

export function listCronJobs(): CronJobDef[] {
  return Array.from(jobs.values())
}

export function getCronJob(key: string): CronJobDef | undefined {
  return jobs.get(key)
}

/** Persist a job descriptor row so the UI can enumerate from DB (includes unregistered legacy jobs too). */
export async function syncJobToDb(def: CronJobDef): Promise<void> {
  await ensureTablesExist()
  const pool = getDbPool()
  await pool.query(
    `INSERT INTO cron_jobs (key, name, description, recommended_interval, enabled)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (key) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           recommended_interval = EXCLUDED.recommended_interval,
           updated_at = NOW()`,
    [def.key, def.name, def.description, def.recommendedInterval],
  )
}

/** Execute a cron job, record status to DB. Never throws — returns {ok, message}. */
export async function runCronJob(key: string): Promise<{ ok: boolean; message: string; durationMs: number }> {
  const def = jobs.get(key)
  if (!def) return { ok: false, message: `Unknown job: ${key}`, durationMs: 0 }

  // Ensure the row exists before UPDATE — otherwise first run silently no-ops on UPDATE
  // and admin UI shows "chưa chạy" even after a successful execution.
  await syncJobToDb(def)
  const pool = getDbPool()
  const start = Date.now()

  try {
    const result = await def.handler()
    const durationMs = Date.now() - start
    const message = (result && typeof result === 'object' && 'message' in result ? String(result.message) : 'OK')
    await pool.query(
      `UPDATE cron_jobs
       SET last_run_at = NOW(),
           last_status = 'ok',
           last_duration_ms = $1,
           last_error = NULL,
           run_count = COALESCE(run_count, 0) + 1,
           updated_at = NOW()
       WHERE key = $2`,
      [durationMs, key],
    )
    return { ok: true, message, durationMs }
  } catch (err) {
    const durationMs = Date.now() - start
    const message = (err as Error).message || 'Error'
    await pool.query(
      `UPDATE cron_jobs
       SET last_run_at = NOW(),
           last_status = 'error',
           last_duration_ms = $1,
           last_error = $2,
           run_count = COALESCE(run_count, 0) + 1,
           updated_at = NOW()
       WHERE key = $3`,
      [durationMs, message.slice(0, 1000), key],
    )
    return { ok: false, message, durationMs }
  }
}
