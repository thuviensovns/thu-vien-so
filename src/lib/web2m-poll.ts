import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'
import { fetchWeb2mHistory, Web2mConfigError, Web2mFetchError, Web2mApiError } from '@/lib/web2m-client'
import { processBankStatementBatch } from '@/lib/bank-statement-processor'
import { revalidatePath } from 'next/cache'

export interface PollResult {
  ok: boolean
  message: string
  total?: number
  credited?: number
  summary?: Record<string, number>
  throttled?: boolean
}

export interface PollOptions {
  /** If last poll was within this many ms, skip and return immediately.
   *  Pass 0 (default) to always poll. Use >0 to coalesce concurrent triggers
   *  (e.g. multiple /topup/status fire-and-forget calls landing at once). */
  minIntervalMs?: number
}

/**
 * Read bank-config, call Web2M, process batch, update poll metadata.
 * Never throws — returns a result object the cron registry persists.
 */
export async function pollWeb2m(options: PollOptions = {}): Promise<PollResult> {
  const payload = await getPayloadForApi()

  // findGlobal returns unknown-shaped until payload-types regen; access fields loosely.
  const cfg = await payload.findGlobal({ slug: 'bank-config' }) as Record<string, unknown>

  if (!cfg?.web2mEnabled) {
    return { ok: true, message: 'Web2M chưa bật — bỏ qua' }
  }

  // Atomic throttle claim: a single UPDATE...WHERE sets web2m_last_poll_at to
  // NOW only if it's older than the throttle window. If no row returns, another
  // concurrent invocation already claimed this window → throttle. This avoids
  // the TOCTOU race where two callers both read "last poll was 5 min ago"
  // before either has written NOW back.
  const minInterval = options.minIntervalMs ?? 0
  if (minInterval > 0) {
    const pool = getDbPool()
    const claim = await pool.query(
      `UPDATE bank_config
         SET web2m_last_poll_at = NOW()
       WHERE web2m_last_poll_at IS NULL
          OR web2m_last_poll_at < NOW() - ($1::int || ' milliseconds')::interval
       RETURNING id, web2m_last_poll_at`,
      [minInterval],
    )
    if (claim.rowCount === 0) {
      return { ok: true, message: `throttled: within ${minInterval}ms window`, throttled: true }
    }
  }

  // `web2mLastPollAt` is always stored as the moment polling FINISHES (NOW() at
  // the end), never the start. Rationale: if we wrote the start-time, the value
  // persisted to DB would be ~7s older than actual last-poll, and the atomic
  // throttle claim above — which compares against this column — would start
  // letting duplicate polls through within the throttle window. Using NOW() via
  // bumpPollTimestamp keeps the column accurate for both "last poll" display
  // and throttle math.
  const bumpPollTimestamp = async (status: string) => {
    const pool = getDbPool()
    try {
      await pool.query(
        `UPDATE bank_config SET web2m_last_poll_at = NOW(), web2m_last_status = $1`,
        [status],
      )
    } catch { /* non-fatal */ }
  }

  try {
    const body = await fetchWeb2mHistory({
      bank: cfg.web2mBank as string | null,
      apiVersion: cfg.web2mApiVersion as string | null,
      apiType: (cfg.web2mApiType as 'openapi' | 'rpa' | null) || 'openapi',
      accountNumber: cfg.web2mAccountNumber as string | null,
      password: cfg.web2mPassword as string | null,
      token: cfg.web2mToken as string | null,
      apiUrl: cfg.web2mApiUrl as string | null,
    })

    if (body.error) {
      const status = `error: Web2M trả về error=true`
      await bumpPollTimestamp(status)
      return { ok: false, message: status }
    }

    const batch = await processBankStatementBatch(payload, body.transactionInfos)

    if (batch.credited > 0) {
      try { revalidatePath('/', 'layout') } catch {}
    }

    const summaryStr = Object.entries(batch.summary).map(([k, v]) => `${k}=${v}`).join(', ') || '0'
    const status = `ok: ${batch.total} tx, credited ${batch.credited} [${summaryStr}]`

    await bumpPollTimestamp(status)

    return {
      ok: true,
      message: status,
      total: batch.total,
      credited: batch.credited,
      summary: batch.summary,
    }
  } catch (err) {
    const msg = err instanceof Web2mConfigError
      ? `config: ${err.message}`
      : err instanceof Web2mApiError
        ? `web2m: ${err.message}`
        : err instanceof Web2mFetchError
          ? `fetch: ${err.message}`
          : `error: ${(err as Error).message}`

    await bumpPollTimestamp(msg)

    return { ok: false, message: msg }
  }
}
