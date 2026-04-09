import { randomUUID } from 'crypto'
import type { Payload } from 'payload'

const DOWNLOAD_EXPIRY_HOURS = 72
const MAX_DOWNLOADS = 5

export interface FulfillResult {
  downloadToken: string
  downloadExpiresAt: string
  orderNumber: string
}

/**
 * Fulfill a paid order: generate download token, update status, increment product download counts.
 * Idempotent — if order already has a downloadToken, returns it without re-processing.
 *
 * Called by ALL payment methods (balance, VNPay, bank-transfer).
 */
export async function fulfillOrder(
  payload: Payload,
  orderId: number | string,
  paymentInfo?: { transactionId?: string; paidAt?: string; rawResponse?: unknown },
): Promise<FulfillResult> {
  const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0 }) as any

  if (!order) throw new Error(`Order ${orderId} not found`)

  // Idempotent: already fulfilled
  if (order.downloadToken) {
    return {
      downloadToken: order.downloadToken,
      downloadExpiresAt: order.downloadExpiresAt,
      orderNumber: order.orderNumber,
    }
  }

  const downloadToken = randomUUID()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + DOWNLOAD_EXPIRY_HOURS)
  const downloadExpiresAt = expiresAt.toISOString()

  // Update order: status=paid + downloadToken
  await payload.update({
    collection: 'orders',
    id: orderId,
    data: {
      status: 'paid',
      downloadToken,
      downloadExpiresAt,
      ...(paymentInfo ? {
        payment: {
          ...order.payment,
          ...paymentInfo,
          paidAt: paymentInfo.paidAt || new Date().toISOString(),
        },
      } : {}),
    },
  })

  // Increment downloadCount on each product (non-blocking, best-effort)
  if (order.items && Array.isArray(order.items)) {
    await Promise.allSettled(
      order.items.map(async (item: any) => {
        const productId = typeof item.product === 'object' ? item.product?.id : item.product
        if (!productId) return
        try {
          const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 })
          await payload.update({
            collection: 'products',
            id: productId,
            data: { downloadCount: ((product as any).downloadCount || 0) + 1 },
          })
        } catch (e) {
          console.error(`[fulfillOrder] Failed to update downloadCount for product ${productId}:`, e)
        }
      })
    )
  }

  return { downloadToken, downloadExpiresAt, orderNumber: order.orderNumber }
}
