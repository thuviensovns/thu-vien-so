import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'
import { listCronJobs, syncJobToDb } from '@/lib/cron-registry'
import '@/lib/cron-jobs' // side-effect: register jobs

/** GET: List all registered cron jobs + their DB state (last run, status, etc). */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'cron.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const pool = getDbPool()

    // Sync registered jobs to DB (so newly added code-registered jobs appear)
    const registered = listCronJobs()
    await Promise.all(registered.map(syncJobToDb))

    const { rows } = await pool.query(
      `SELECT key, name, description, recommended_interval, last_run_at, last_status,
              last_duration_ms, last_error, run_count, enabled, updated_at
       FROM cron_jobs
       ORDER BY name ASC`,
    )
    return NextResponse.json({
      docs: rows.map((r: Record<string, unknown>) => ({
        key: r.key,
        name: r.name,
        description: r.description || '',
        recommendedInterval: r.recommended_interval || '',
        lastRunAt: r.last_run_at,
        lastStatus: r.last_status || null,
        lastDurationMs: r.last_duration_ms,
        lastError: r.last_error || null,
        runCount: r.run_count || 0,
        enabled: !!r.enabled,
        updatedAt: r.updated_at,
        isRegistered: registered.some((j) => j.key === r.key),
      })),
    })
  } catch (error) {
    console.error('[cron] GET error:', error)
    return NextResponse.json({ docs: [] })
  }
}

/** PATCH: Toggle a job's enabled flag. Body: { key, enabled }. */
export async function PATCH(req: NextRequest) {
  const guard = await requirePermission(req, 'cron.edit')
  if (guard instanceof NextResponse) return guard
  try {
    let body: { key?: string; enabled?: boolean }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body.key) return NextResponse.json({ error: 'key bắt buộc' }, { status: 400 })

    const pool = getDbPool()
    await pool.query(
      `UPDATE cron_jobs SET enabled = $1, updated_at = NOW() WHERE key = $2`,
      [!!body.enabled, body.key],
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
