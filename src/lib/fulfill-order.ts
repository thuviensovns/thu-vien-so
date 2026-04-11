import { randomUUID } from 'crypto'
import type { Payload } from 'payload'
import type { Order, OrderItem, Product } from '@/types/payload-types'

const DOWNLOAD_EXPIRY_HOURS = 72
const REDOWNLOAD_EXPIRY_DAYS = 365
const REDOWNLOAD_MAX_COUNT = 10

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
  const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0 }) as Order

  if (!order) throw new Error(`Order ${orderId} not found`)

  // Idempotent: already fulfilled
  if (order.downloadToken) {
    return {
      downloadToken: order.downloadToken,
      downloadExpiresAt: order.downloadExpiresAt!,
      orderNumber: order.orderNumber,
    }
  }

  const downloadToken = randomUUID()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + DOWNLOAD_EXPIRY_HOURS)
  const downloadExpiresAt = expiresAt.toISOString()

  // Update order: status=paid + downloadToken
  // overrideAccess: this runs from trusted payment webhooks and the balance-pay flow;
  // customers cannot otherwise update orders (admin-only per Orders.access.update).
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
    overrideAccess: true,
  })

  // Create per-product download records + bump product.downloadCount.
  // Download records power the /tai-khoan?tab=downloads re-download UI.
  const orderUserId = typeof order.user === 'object' ? (order.user as { id: number | string }).id : order.user
  const redownloadExpiresAt = new Date()
  redownloadExpiresAt.setDate(redownloadExpiresAt.getDate() + REDOWNLOAD_EXPIRY_DAYS)
  const redownloadExpiresAtIso = redownloadExpiresAt.toISOString()

  if (order.items && Array.isArray(order.items)) {
    await Promise.allSettled(
      order.items.map(async (item: OrderItem) => {
        const productId = typeof item.product === 'object' ? (item.product as Product).id : item.product
        if (!productId || !orderUserId) return

        // 1. Idempotent download record (skip if this order already has one for this product)
        try {
          const existing = await payload.find({
            collection: 'downloads',
            where: {
              and: [
                { order: { equals: orderId } },
                { product: { equals: productId } },
              ],
            },
            limit: 1,
            overrideAccess: true,
          })
          if (existing.docs.length === 0) {
            await payload.create({
              collection: 'downloads',
              data: {
                user: orderUserId as number,
                order: orderId as number,
                product: productId as number,
                downloadCount: 0,
                maxDownloads: REDOWNLOAD_MAX_COUNT,
                expiresAt: redownloadExpiresAtIso,
              },
              overrideAccess: true,
            })
          }
        } catch (e) {
          console.error(`[fulfillOrder] Failed to create download record for product ${productId}:`, e)
        }

        // 2. Bump product.downloadCount (best-effort)
        try {
          const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 }) as Product
          await payload.update({
            collection: 'products',
            id: productId,
            data: { downloadCount: (product.downloadCount || 0) + 1 },
            overrideAccess: true,
          })
        } catch (e) {
          console.error(`[fulfillOrder] Failed to update downloadCount for product ${productId}:`, e)
        }
      })
    )
  }

  return { downloadToken, downloadExpiresAt, orderNumber: order.orderNumber }
}
