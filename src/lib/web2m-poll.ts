import { getPayloadForApi } from '@/lib/payload'
import { fetchWeb2mHistory, Web2mConfigError, Web2mFetchError, Web2mApiError } from '@/lib/web2m-client'
import { processBankStatementBatch } from '@/lib/bank-statement-processor'
import { revalidatePath } from 'next/cache'

export interface PollResult {
  ok: boolean
  message: string
  total?: number
  credited?: number
  summary?: Record<string, number>
}

/**
 * Read bank-config, call Web2M, process batch, update poll metadata.
 * Never throws — returns a result object the cron registry persists.
 */
export async function pollWeb2m(): Promise<PollResult> {
  const payload = await getPayloadForApi()

  // findGlobal returns unknown-shaped until payload-types regen; access fields loosely.
  const cfg = await payload.findGlobal({ slug: 'bank-config' }) as Record<string, unknown>

  if (!cfg?.web2mEnabled) {
    return { ok: true, message: 'Web2M chưa bật — bỏ qua' }
  }

  const timestamp = new Date().toISOString()

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
      await payload.updateGlobal({
        slug: 'bank-config',
        data: { web2mLastPollAt: timestamp, web2mLastStatus: status },
      })
      return { ok: false, message: status }
    }

    const batch = await processBankStatementBatch(payload, body.transactionInfos)

    if (batch.credited > 0) {
      try { revalidatePath('/', 'layout') } catch {}
    }

    const summaryStr = Object.entries(batch.summary).map(([k, v]) => `${k}=${v}`).join(', ') || '0'
    const status = `ok: ${batch.total} tx, credited ${batch.credited} [${summaryStr}]`

    await payload.updateGlobal({
      slug: 'bank-config',
      data: { web2mLastPollAt: timestamp, web2mLastStatus: status },
    })

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

    try {
      await payload.updateGlobal({
        slug: 'bank-config',
        data: { web2mLastPollAt: timestamp, web2mLastStatus: msg },
      })
    } catch { /* non-fatal */ }

    return { ok: false, message: msg }
  }
}
