import type { Payload } from 'payload'
import { fulfillOrder } from '@/lib/fulfill-order'
import type { BankStatementTransaction } from '@/types/domain'
import type { Order, TopUp, User } from '@/types/payload-types'

export type TxResult =
  | { id: string; status: 'skipped'; reason: string }
  | { id: string; status: 'duplicate' }
  | { id: string; status: 'order-fulfilled'; orderNumber: string; amount: number }
  | { id: string; status: 'topup-completed'; topupId: number | string; credited: number }
  | { id: string; status: 'topup-auto'; userId: number | string; credited: number }
  | { id: string; status: 'no-match'; reason: string }
  | { id: string; status: 'error'; error: string }

export interface BatchResult {
  total: number
  credited: number
  summary: Record<string, number>
  results: TxResult[]
}

/**
 * Process one incoming bank transaction.
 *
 * Matching (read from `description` + `reference`):
 *   1. MUS-XXX-XXX   → fulfill pending order
 *   2. NAPKH{userId} → pending bank-transfer order OR auto-credit user balance
 *   3. NAP[A-Z0-9]{4,12} → confirm pending topup
 *
 * Replay protection via `topups.bankTransactionId` unique lookup.
 */
export async function processBankTransaction(
  payload: Payload,
  tx: BankStatementTransaction,
): Promise<TxResult> {
  const bankTxId = String(tx.id || '').trim()
  if (!bankTxId) return { id: '', status: 'error', error: 'Missing transaction id' }

  if (tx.creditDebitIndicator !== 'CRDT') {
    return { id: bankTxId, status: 'skipped', reason: 'Not an incoming transfer' }
  }

  const amount = Number(tx.amount)
  if (!amount || amount <= 0) {
    return { id: bankTxId, status: 'error', error: 'Invalid amount' }
  }

  const duplicate = await payload.find({
    collection: 'topups',
    where: { bankTransactionId: { equals: bankTxId } },
    limit: 1,
  })
  if (duplicate.totalDocs > 0) return { id: bankTxId, status: 'duplicate' }

  const content = `${tx.description || ''} ${tx.reference || ''}`.toUpperCase()

  const orderMatch = content.match(/\b(MUS-[A-Z0-9]+-[A-Z0-9]+)\b/)
  if (orderMatch) {
    const orderNumber = orderMatch[0]
    const orderResult = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber }, status: { equals: 'pending' } },
      limit: 1,
      depth: 0,
    })
    if (orderResult.totalDocs > 0) {
      const order = orderResult.docs[0] as Order
      const tolerance = Math.min(5000, order.total * 0.1)
      if (amount < order.total - tolerance) {
        return { id: bankTxId, status: 'error', error: `Amount ${amount} too low for order ${orderNumber} (${order.total})` }
      }
      await fulfillOrder(payload, order.id, {
        transactionId: bankTxId,
        paidAt: new Date().toISOString(),
        rawResponse: { source: 'bank-statement', bankTxId, amount, content },
      })
      return { id: bankTxId, status: 'order-fulfilled', orderNumber, amount }
    }
  }

  const napkhMatch = content.match(/\bNAPKH(\d{4,})\b/)
  if (napkhMatch) {
    const transferCode = napkhMatch[0]
    const extractedUserId = parseInt(napkhMatch[1], 10)

    const orderResult = await payload.find({
      collection: 'orders',
      where: {
        transferCode: { equals: transferCode },
        status: { equals: 'pending' },
        'payment.method': { equals: 'bank-transfer' },
      },
      limit: 1,
      sort: '-createdAt',
      depth: 0,
    })
    if (orderResult.totalDocs > 0) {
      const order = orderResult.docs[0] as Order
      const tolerance = Math.min(5000, order.total * 0.1)
      if (amount >= order.total - tolerance) {
        await fulfillOrder(payload, order.id, {
          transactionId: bankTxId,
          paidAt: new Date().toISOString(),
          rawResponse: { source: 'bank-statement', bankTxId, amount, content },
        })
        return { id: bankTxId, status: 'order-fulfilled', orderNumber: order.orderNumber, amount }
      }
    }

    try {
      const targetUser = await payload.findByID({ collection: 'users', id: extractedUserId }) as User
      if (!targetUser) return { id: bankTxId, status: 'no-match', reason: `User ${extractedUserId} not found` }

      const newTopup = await payload.create({
        collection: 'topups',
        data: {
          user: extractedUserId,
          amount,
          transferCode: `${transferCode}${Date.now().toString(36).slice(-4).toUpperCase()}`,
          status: 'completed',
          bankTransactionId: bankTxId,
          bankDescription: content,
          confirmedAt: new Date().toISOString(),
          creditedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })

      const currentBalance = targetUser.balance || 0
      await payload.update({
        collection: 'users',
        id: extractedUserId,
        data: { balance: currentBalance + amount },
        overrideAccess: true,
      })

      try {
        const { accrueCommission } = await import('@/lib/affiliate')
        await accrueCommission({
          referredUserId: Number(extractedUserId),
          baseAmount: amount,
          sourceType: 'topup',
          sourceId: String(newTopup.id),
        })
      } catch { /* non-fatal */ }

      return { id: bankTxId, status: 'topup-auto', userId: extractedUserId, credited: amount }
    } catch {
      return { id: bankTxId, status: 'no-match', reason: `User ${extractedUserId} lookup failed` }
    }
  }

  const topupCodeMatch = content.match(/\bNAP[A-Z0-9]{4,12}\b/)
  if (!topupCodeMatch) {
    return { id: bankTxId, status: 'no-match', reason: 'No transfer code in description' }
  }
  const topupTransferCode = topupCodeMatch[0]

  const topupResult = await payload.find({
    collection: 'topups',
    where: { transferCode: { equals: topupTransferCode }, status: { equals: 'pending' } },
    limit: 1,
    depth: 1,
  })
  if (topupResult.totalDocs === 0) {
    return { id: bankTxId, status: 'no-match', reason: `No pending topup for ${topupTransferCode}` }
  }

  const topup = topupResult.docs[0] as TopUp
  const tolerance = Math.min(5000, topup.amount * 0.1)
  if (amount < topup.amount - tolerance) {
    return { id: bankTxId, status: 'error', error: `Amount ${amount} too low for topup ${topup.amount}` }
  }

  const freshTopup = await payload.findByID({ collection: 'topups', id: topup.id }) as TopUp
  if (freshTopup.status !== 'pending') {
    return { id: bankTxId, status: 'duplicate' }
  }

  // Mark topup completed + credited. Skip the auto-credit afterChange hook —
  // we update balance manually below.
  await payload.update({
    collection: 'topups',
    id: topup.id,
    data: {
      status: 'completed',
      bankTransactionId: bankTxId,
      bankDescription: content,
      confirmedAt: new Date().toISOString(),
      creditedAt: new Date().toISOString(),
    },
    context: { skipAutoCredit: true },
  })

  const userId = typeof topup.user === 'object' ? topup.user.id : topup.user
  const currentUser = await payload.findByID({ collection: 'users', id: userId }) as User
  const currentBalance = currentUser.balance || 0
  const creditAmount = Math.min(amount, topup.amount)

  await payload.update({
    collection: 'users',
    id: userId,
    data: { balance: currentBalance + creditAmount },
    overrideAccess: true,
  })

  try {
    const { accrueCommission } = await import('@/lib/affiliate')
    await accrueCommission({
      referredUserId: Number(userId),
      baseAmount: creditAmount,
      sourceType: 'topup',
      sourceId: String(topup.id),
    })
  } catch { /* non-fatal */ }

  return { id: bankTxId, status: 'topup-completed', topupId: topup.id, credited: creditAmount }
}

export async function processBankStatementBatch(
  payload: Payload,
  transactions: BankStatementTransaction[],
): Promise<BatchResult> {
  const results: TxResult[] = []
  let credited = 0

  for (const tx of transactions) {
    try {
      const result = await processBankTransaction(payload, tx)
      results.push(result)
      if (result.status === 'topup-completed' || result.status === 'topup-auto' || result.status === 'order-fulfilled') {
        credited++
      }
    } catch (err) {
      results.push({
        id: String(tx.id || ''),
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  return { total: results.length, credited, summary, results }
}
