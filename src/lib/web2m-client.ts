import type { BankStatementBody, BankStatementTransaction } from '@/types/domain'

export interface Web2mConfig {
  enabled?: boolean | null
  bank?: string | null
  apiVersion?: string | null
  accountNumber?: string | null
  password?: string | null
  token?: string | null
  apiUrl?: string | null
  /** 'openapi' uses the sPayment OpenAPI endpoint (token only), 'rpa' uses the legacy
   *  IB-scraping endpoint (password + account + token). Defaults to 'openapi'. */
  apiType?: 'openapi' | 'rpa' | null
}

export class Web2mConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Web2mConfigError'
  }
}

export class Web2mFetchError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'Web2mFetchError'
    this.status = status
  }
}

export class Web2mApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Web2mApiError'
  }
}

/**
 * URL templates per bank for each API type.
 *   RPA     → historyapi{bank}/{password}/{account}/{token}
 *   OpenAPI → historyapiopen{bank}/{token}   (no password / account needed)
 */
const RPA_URL_TEMPLATES: Record<string, string> = {
  acb: 'https://api.web2m.com/historyapiacb/{password}/{account}/{token}',
  bidv: 'https://api.web2m.com/historyapibidv/{password}/{account}/{token}',
  mbbank: 'https://api.web2m.com/historyapimbbank/{password}/{account}/{token}',
  tpbank: 'https://api.web2m.com/historyapitpbank/{password}/{account}/{token}',
  vietcombank: 'https://api.web2m.com/historyapivcb/{password}/{account}/{token}',
  techcombank: 'https://api.web2m.com/historyapitcb/{password}/{account}/{token}',
  vietinbank: 'https://api.web2m.com/historyapivietin/{password}/{account}/{token}',
}

const OPENAPI_URL_TEMPLATES: Record<string, string> = {
  acb: 'https://api.web2m.com/historyapiopenacb/{token}',
  bidv: 'https://api.web2m.com/historyapiopenbidv/{token}',
  mbbank: 'https://api.web2m.com/historyapiopenmbbank/{token}',
  tpbank: 'https://api.web2m.com/historyapiopentpbank/{token}',
  vietcombank: 'https://api.web2m.com/historyapiopenvcb/{token}',
  techcombank: 'https://api.web2m.com/historyapiopentcb/{token}',
  vietinbank: 'https://api.web2m.com/historyapiopenvietin/{token}',
}

/**
 * Build the Web2M history API URL from config.
 * - OpenAPI mode: only needs `token`; endpoint is bank-specific but account/password
 *   are managed on the sPayment side after OpenBanking OAuth linking.
 * - RPA mode: legacy IB-scraping; needs account + password + token.
 * User can override with a custom `apiUrl` containing {account}/{password}/{token}.
 */
export function buildWeb2mUrl(cfg: Web2mConfig): string {
  const token = cfg.token?.trim()
  if (!token) throw new Web2mConfigError('Thiếu token Web2M')

  const apiType = (cfg.apiType || 'openapi').trim() as 'openapi' | 'rpa'
  const bank = (cfg.bank?.trim() || 'acb')

  if (cfg.apiUrl?.trim()) {
    // Custom override — expand all placeholders it may contain.
    return cfg.apiUrl.trim()
      .replace(/\{account\}/g, encodeURIComponent(cfg.accountNumber?.trim() || ''))
      .replace(/\{password\}/g, encodeURIComponent(cfg.password?.trim() || ''))
      .replace(/\{token\}/g, encodeURIComponent(token))
  }

  if (apiType === 'openapi') {
    const template = OPENAPI_URL_TEMPLATES[bank] || OPENAPI_URL_TEMPLATES.acb
    return template.replace(/\{token\}/g, encodeURIComponent(token))
  }

  // RPA
  const account = cfg.accountNumber?.trim()
  const password = cfg.password?.trim()
  if (!account) throw new Web2mConfigError('RPA mode: thiếu số tài khoản')
  if (!password) throw new Web2mConfigError('RPA mode: thiếu mật khẩu ngân hàng')

  const template = RPA_URL_TEMPLATES[bank] || RPA_URL_TEMPLATES.acb
  return template
    .replace(/\{account\}/g, encodeURIComponent(account))
    .replace(/\{password\}/g, encodeURIComponent(password))
    .replace(/\{token\}/g, encodeURIComponent(token))
}

/** Fetch transaction history from Web2M and parse to BankStatementBody. */
export async function fetchWeb2mHistory(cfg: Web2mConfig, timeoutMs = 20000): Promise<BankStatementBody> {
  const url = buildWeb2mUrl(cfg)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    })
  } catch (err) {
    clearTimeout(timer)
    if ((err as Error).name === 'AbortError') {
      throw new Web2mFetchError(`Web2M timeout after ${timeoutMs}ms`)
    }
    throw new Web2mFetchError(`Web2M fetch failed: ${(err as Error).message}`)
  }
  clearTimeout(timer)

  if (!res.ok) {
    throw new Web2mFetchError(`Web2M HTTP ${res.status}`, res.status)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new Web2mFetchError('Web2M trả về non-JSON response')
  }

  // Web2M returns { status: false, msg: "..." } or { success: false, message: "..." } on error
  if (data && typeof data === 'object') {
    const raw = data as Record<string, unknown>
    const isError =
      (raw.status === false) ||
      (raw.success === false && !Array.isArray(raw.transactions) && !Array.isArray(raw.transactionInfos))
    if (isError) {
      const msg = String(raw.msg || raw.message || raw.error || 'Web2M API trả về lỗi')
      throw new Web2mApiError(msg)
    }
  }

  return normalizeWeb2mResponse(data)
}

/**
 * Normalize Web2M responses across versions/banks into BankStatementBody.
 * Handles variants:
 *  - { transactionInfos: [...], error, total }  (BIDV-like)
 *  - { status: true, transactions: [...] }       (v1/v2 flat format)
 *  - { data: { transactionInfos: [...] } }       (wrapped)
 */
export function normalizeWeb2mResponse(data: unknown): BankStatementBody {
  if (!data || typeof data !== 'object') {
    return { transactionInfos: [], error: true, total: 0 }
  }

  const raw = data as Record<string, unknown>
  const wrapped = (raw.data && typeof raw.data === 'object' ? raw.data as Record<string, unknown> : raw)

  let txs: unknown[] = []
  if (Array.isArray(wrapped.transactionInfos)) {
    txs = wrapped.transactionInfos
  } else if (Array.isArray(wrapped.transactions)) {
    txs = wrapped.transactions
  } else if (Array.isArray(raw.transactionInfos)) {
    txs = raw.transactionInfos
  }

  const transactions: BankStatementTransaction[] = txs.map((t) => normalizeTx(t as Record<string, unknown>))

  return {
    transactionInfos: transactions,
    error: raw.error === true,
    total: typeof raw.total === 'number' ? raw.total : transactions.length,
  }
}

/** Map a raw Web2M transaction row to BankStatementTransaction, coercing common field aliases. */
function normalizeTx(t: Record<string, unknown>): BankStatementTransaction {
  const id = t.id ?? t.transactionNumber ?? t.transactionID ?? t.transactionId ?? t.tid ?? ''
  const description = (t.description ?? t.content ?? t.remark ?? t.note ?? '') as string
  const reference = (t.reference ?? t.referenceNumber ?? t.ref ?? '') as string
  const amountRaw = t.amount ?? t.value ?? t.transferAmount ?? 0
  const amount = typeof amountRaw === 'number' ? amountRaw : Number(String(amountRaw).replace(/[,\s]/g, ''))

  // Credit/debit: ACB uses "IN"/"OUT"; BIDV uses "CRDT"/"DBIT"; SePay uses "in"/"out"
  let creditDebitIndicator: 'CRDT' | 'DBIT' = 'DBIT'
  const cdi = t.creditDebitIndicator as string | undefined
  if (cdi === 'CRDT' || cdi === 'DBIT') {
    creditDebitIndicator = cdi
  } else if (typeof t.type === 'string') {
    creditDebitIndicator = /^(in|credit|crdt|\+|cong)/i.test(t.type) ? 'CRDT' : 'DBIT'
  } else if (typeof t.transferType === 'string') {
    creditDebitIndicator = t.transferType === 'in' ? 'CRDT' : 'DBIT'
  } else if (amount > 0) {
    creditDebitIndicator = 'CRDT'
  }

  return {
    id: String(id || ''),
    arrangementId: (t.arrangementId as string) || undefined,
    reference: String(reference || ''),
    description: String(description || ''),
    bookingDate: toIsoDate(t.bookingDate ?? t.postingDate ?? t.transactionDate),
    valueDate: toIsoDate(t.valueDate ?? t.effectiveDate ?? t.activeDatetime),
    amount,
    currency: (t.currency as string) || 'VND',
    creditDebitIndicator,
    runningBalance: (t.runningBalance as string | number) ?? undefined,
  }
}

function toIsoDate(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'number') return new Date(v).toISOString()
  if (typeof v === 'string') {
    const n = Number(v)
    if (!Number.isNaN(n) && n > 1e12) return new Date(n).toISOString()
    return v
  }
  return undefined
}
