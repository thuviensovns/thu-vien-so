/**
 * Instant buy via account balance.
 *
 * When user clicks "Mua ngay" and their balance covers the price, we skip
 * the checkout page entirely: create a balance-method order and pay it in
 * one roundtrip, then let the caller redirect to the download result page.
 *
 * Falls back to normal checkout flow on any failure (insufficient balance,
 * auth expired, network error).
 */
export type InstantBuyResult =
  | { ok: true; orderId: string | number; orderNumber: string; downloadToken: string; newBalance: number }
  | { ok: false; reason: 'unauthorized' | 'insufficient' | 'error'; message?: string }

export async function instantBuyWithBalance(productId: string): Promise<InstantBuyResult> {
  try {
    const createRes = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        items: [{ productId }],
        paymentMethod: 'balance',
      }),
    })

    if (createRes.status === 401) return { ok: false, reason: 'unauthorized' }
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}))
      return { ok: false, reason: 'error', message: err?.error }
    }
    const orderData = await createRes.json()

    const payRes = await fetch('/api/payment/pay-with-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ orderId: orderData.orderId }),
    })

    if (payRes.status === 401) return { ok: false, reason: 'unauthorized' }
    if (!payRes.ok) {
      const err = await payRes.json().catch(() => ({}))
      const msg: string = err?.error || ''
      if (msg.includes('Số dư không đủ')) return { ok: false, reason: 'insufficient', message: msg }
      return { ok: false, reason: 'error', message: msg }
    }

    const payData = await payRes.json()
    return {
      ok: true,
      orderId: orderData.orderId,
      orderNumber: payData.orderNumber || orderData.orderNumber || '',
      downloadToken: payData.downloadToken || '',
      newBalance: Number(payData.newBalance) || 0,
    }
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error).message }
  }
}

export function buildDownloadResultUrl(orderNumber: string, token: string): string {
  const params = new URLSearchParams({ status: 'success', orderNumber, token })
  return `/thanh-toan/ket-qua?${params.toString()}`
}
