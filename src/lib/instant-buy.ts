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
export type InstantBuyResult =
  | { ok: true; orderId: string | number; orderNumber: string; downloadToken: string; newBalance: number }
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
    }
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error).message }
  }
}

export function buildDownloadResultUrl(orderNumber: string, token: string): string {
  const params = new URLSearchParams({ status: 'success', orderNumber, token })
  return `/thanh-toan/ket-qua?${params.toString()}`
}
