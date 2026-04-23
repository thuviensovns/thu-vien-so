import type { Payload } from 'payload'
import { fulfillOrder } from '@/lib/fulfill-order'
import type { Order, User } from '@/types/payload-types'

export interface AutoSettleResult {
  settled: Array<{ orderNumber: string; total: number; downloadToken: string }>
  skippedInsufficient: number
}

/**
 * Auto-settle a user's pending orders using their current wallet balance.
 *
 * Called after any balance credit (topup confirmation, bank-transfer auto-
 * credit, admin manual credit). Iterates pending orders oldest-first and
 * pays each one the user's balance can cover — marking them 'paid' with a
 * downloadToken, exactly as the instant-buy flow does.
 *
 * Safe to call repeatedly: fulfillOrder is idempotent (checks existing
 * downloadToken) and we re-read user+order on each iteration to tolerate
 * concurrent settles from parallel credit events.
 */
export async function autoSettlePendingOrders(
  payload: Payload,
  userId: number | string,
): Promise<AutoSettleResult> {
  const pending = await payload.find({
    collection: 'orders',
    where: {
      user: { equals: userId },
      status: { equals: 'pending' },
    },
    sort: 'createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  const settled: AutoSettleResult['settled'] = []
  let skippedInsufficient = 0

  if (pending.totalDocs === 0) {
    return { settled, skippedInsufficient }
  }

  for (const doc of pending.docs) {
    const order = doc as Order
    const total = order.total
    if (!total || total <= 0) continue

    // Fresh reads: another parallel credit event may have already settled
    // this order, and earlier iterations in this loop moved the balance.
    let freshUser: User
    let freshOrder: Order
    try {
      ;[freshUser, freshOrder] = await Promise.all([
        payload.findByID({ collection: 'users', id: userId }) as Promise<User>,
        payload.findByID({ collection: 'orders', id: order.id, depth: 0 }) as Promise<Order>,
      ])
    } catch (e) {
      console.error(`[auto-settle] Fresh-read failed for order ${order.orderNumber}:`, e)
      continue
    }

    if (freshOrder.status !== 'pending') continue

    const currentBalance = freshUser.balance || 0
    if (currentBalance < total) {
      skippedInsufficient++
      continue
    }

    try {
      // Claim the order first so a concurrent credit event skips it.
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: { status: 'processing' },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'users',
        id: userId,
        data: { balance: currentBalance - total },
        overrideAccess: true,
      })

      const result = await fulfillOrder(payload, order.id, {
        paidAt: new Date().toISOString(),
        rawResponse: { source: 'auto-settle-from-balance-credit' },
      })

      settled.push({
        orderNumber: result.orderNumber,
        total,
        downloadToken: result.downloadToken,
      })
    } catch (e) {
      console.error(`[auto-settle] Failed for order ${order.orderNumber}:`, e)
      // Best-effort rollback — refund the deduction and revert status.
      try {
        const cur = await payload.findByID({ collection: 'users', id: userId }) as User
        await payload.update({
          collection: 'users',
          id: userId,
          data: { balance: (cur.balance || 0) + total },
          overrideAccess: true,
        })
      } catch (refundErr) {
        console.error(`[auto-settle] Refund failed for order ${order.orderNumber}:`, refundErr)
      }
      try {
        await payload.update({
          collection: 'orders',
          id: order.id,
          data: { status: 'pending' },
          overrideAccess: true,
        })
      } catch {}
    }
  }

  return { settled, skippedInsufficient }
}
