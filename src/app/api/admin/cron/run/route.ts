import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { runCronJob, getCronJob } from '@/lib/cron-registry'
import { logAdminActivity } from '@/lib/log-activity'
import '@/lib/cron-jobs' // side-effect: register jobs

/** POST: Manually trigger a cron job. Body: { key }. */
export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, 'cron.run')
  if (guard instanceof NextResponse) return guard
  const { user } = guard
  try {
    let body: { key?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body.key) return NextResponse.json({ error: 'key bắt buộc' }, { status: 400 })

    const job = getCronJob(body.key)
    if (!job) return NextResponse.json({ error: `Job không tồn tại: ${body.key}` }, { status: 404 })

    const result = await runCronJob(body.key)

    await logAdminActivity(req, {
      type: 'cron',
      action: 'Chạy cron thủ công',
      detail: `${body.key} — ${result.ok ? 'OK' : 'ERROR'} (${result.durationMs}ms): ${result.message}`,
      adminEmail: user.email || 'admin',
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

/** GET: Run a job via token (for external schedulers).
 *  Requires `?key=...&token=CRON_SECRET` — no session cookie needed. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const key = sp.get('key') || ''
  const token = sp.get('token') || ''
  const secret = process.env.CRON_SECRET || ''

  if (!secret) return NextResponse.json({ error: 'CRON_SECRET chưa cấu hình' }, { status: 500 })
  if (token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  const job = getCronJob(key)
  if (!job) return NextResponse.json({ error: `Unknown job: ${key}` }, { status: 404 })

  const result = await runCronJob(key)
  return NextResponse.json(result)
}
