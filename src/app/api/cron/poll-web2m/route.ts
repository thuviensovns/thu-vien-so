import { NextRequest, NextResponse } from 'next/server'
import { runCronJob } from '@/lib/cron-registry'
import '@/lib/cron-jobs' // side-effect: register jobs

/**
 * Dedicated Vercel Cron target for poll_web2m.
 *
 * Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET`.
 * External schedulers (cron-job.org, UptimeRobot) can use `?token=` query.
 *
 * vercel.json entry:
 *   { "path": "/api/cron/poll-web2m", "schedule": "* / 2 * * *" }
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || ''
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET chưa cấu hình' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') || ''
  const bearer = auth.replace(/^Bearer\s+/i, '')
  const queryToken = req.nextUrl.searchParams.get('token') || ''

  if (bearer !== secret && queryToken !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runCronJob('poll_web2m')
  return NextResponse.json(result)
}
