import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { processBankStatementBatch } from '@/lib/bank-statement-processor'
import { revalidatePath } from 'next/cache'
import type { BankStatementBody } from '@/types/domain'

/**
 * Batch bank-statement ingest endpoint.
 *
 * Accepts payload of form:
 *   { transactionInfos: [ { id, description, amount, creditDebitIndicator, ... } ], error, total }
 *
 * Processes only CRDT (incoming) transactions. Uses `id` as idempotency key
 * stored in topups.bankTransactionId to prevent replay / double-credit.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.BANK_STATEMENT_API_KEY
    if (!apiKey) {
      console.error('[BankStatement] BANK_STATEMENT_API_KEY not configured')
      return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 500 })
    }

    const authHeader = req.headers.get('authorization')
    const headerKey = authHeader?.replace(/^(Bearer |Apikey )/i, '')
    if (headerKey !== apiKey) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let body: BankStatementBody
    try { body = await req.json() } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    if (!Array.isArray(body.transactionInfos)) {
      return NextResponse.json({ success: false, error: 'Missing transactionInfos array' }, { status: 400 })
    }

    const payload = await getPayloadForApi()
    const batch = await processBankStatementBatch(payload, body.transactionInfos)

    if (batch.credited > 0) {
      try { revalidatePath('/', 'layout') } catch {}
    }

    console.log('[BankStatement] Batch processed:', { total: batch.total, summary: batch.summary })

    return NextResponse.json({
      success: true,
      total: batch.total,
      summary: batch.summary,
      results: batch.results,
    })
  } catch (error) {
    console.error('[BankStatement] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'bank-statement-ingest' })
}
