/**
 * Instant buy via account balance.
 *
 * When user clicks "Mua ngay" and their balance covers the price, a single
 * POST to /api/payment/instant-buy creates+pays+fulfills the order in one
 * round-trip — perceptibly faster than the old two-call flow.
 *
 * Falls back to normal checkout flow on any failure (insufficient balance,
 * auth expired, network error).
 */
export interface InstantBuyDownloadItem {
  productId: string | number
  name: string
  hasFile: boolean
  fileName: string | null
  fileSize: number | null
  fileFormat: string | null
  url: string | null
}

export type InstantBuyResult =
  | {
      ok: true
      orderId: string | number
      orderNumber: string
      downloadToken: string
      newBalance: number
      downloadItems: InstantBuyDownloadItem[]
    }
  | { ok: false; reason: 'unauthorized' | 'insufficient' | 'error'; message?: string }

export async function instantBuyWithBalance(productId: string): Promise<InstantBuyResult> {
  try {
    const res = await fetch('/api/payment/instant-buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ items: [{ productId }] }),
    })

    if (res.status === 401) return { ok: false, reason: 'unauthorized' }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg: string = err?.error || ''
      if (msg.includes('Số dư không đủ')) return { ok: false, reason: 'insufficient', message: msg }
      return { ok: false, reason: 'error', message: msg }
    }

    const data = await res.json()
    return {
      ok: true,
      orderId: data.orderId,
      orderNumber: data.orderNumber || '',
      downloadToken: data.downloadToken || '',
      newBalance: Number(data.newBalance) || 0,
      downloadItems: Array.isArray(data.downloadItems) ? data.downloadItems : [],
    }
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error).message }
  }
}

export function buildDownloadResultUrl(orderNumber: string, token: string): string {
  const params = new URLSearchParams({ status: 'success', orderNumber, token })
  return `/thanh-toan/ket-qua?${params.toString()}`
}

/** sessionStorage key for handing downloadItems from instant-buy → result page */
export function instantBuyStashKey(token: string): string {
  return `instant-buy:${token}`
}

export interface InstantBuyStash {
  orderNumber: string
  items: InstantBuyDownloadItem[]
  ts: number
}

export function stashInstantBuyResult(token: string, data: Omit<InstantBuyStash, 'ts'>): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(instantBuyStashKey(token), JSON.stringify({ ...data, ts: Date.now() }))
  } catch { /* quota / private mode — non-fatal */ }
}

export function readInstantBuyStash(token: string): InstantBuyStash | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(instantBuyStashKey(token))
    if (!raw) return null
    const parsed = JSON.parse(raw) as InstantBuyStash
    if (!parsed?.items?.length) return null
    return parsed
  } catch {
    return null
  }
}

export function clearInstantBuyStash(token: string): void {
  if (typeof sessionStorage === 'undefined') return
  try { sessionStorage.removeItem(instantBuyStashKey(token)) } catch {}
}
