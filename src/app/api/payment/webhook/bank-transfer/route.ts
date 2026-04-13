import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { fulfillOrder } from '@/lib/fulfill-order'
import { revalidatePath } from 'next/cache'
import type { Order, TopUp, User } from '@/types/payload-types'
import type { SepayWebhookBody } from '@/types/domain'

/**
 * Sepay / Casso webhook for bank transfer notifications.
 *
 * Sepay sends POST with JSON body containing transfer details.
 * We match the transferCode (e.g. "NAP1A2B3C") from the "content" field
 * against pending top-ups in our database.
 */
export async function POST(req: NextRequest) {
  try {
    // REQUIRED: Verify API key from Sepay
    const apiKey = process.env.SEPAY_WEBHOOK_KEY
    if (!apiKey) {
      console.error('[Sepay Webhook] SEPAY_WEBHOOK_KEY not configured')
      return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 500 })
    }

    const authHeader = req.headers.get('authorization')
    const headerKey = authHeader?.replace(/^(Bearer |Apikey )/i, '')
    if (headerKey !== apiKey) {
      console.warn('[Sepay Webhook] Invalid API key')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayloadForApi()

    let body: SepayWebhookBody
    try { body = await req.json() } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    // Log only non-sensitive fields for debugging
    console.log('[Sepay Webhook] Received transfer:', { transferType: body.transferType, id: body.id, gateway: body.gateway })

    // Only process incoming transfers
    if (body.transferType !== 'in') {
      return NextResponse.json({ success: true, message: 'Ignored outgoing transfer' })
    }

    const amount = Number(body.transferAmount)
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    // SECURITY: Require bankTransactionId for replay protection
    const bankTxId = String(body.id || body.referenceCode || '').trim()
    if (!bankTxId) {
      console.warn('[Sepay Webhook] Missing bankTransactionId — rejecting')
      return NextResponse.json({ success: false, error: 'Missing transaction ID' }, { status: 400 })
    }

    // Replay protection: check bankTransactionId uniqueness
    const duplicate = await payload.find({
      collection: 'topups',
      where: { bankTransactionId: { equals: bankTxId } },
      limit: 1,
    })
    if (duplicate.totalDocs > 0) {
      console.log('[Sepay Webhook] Duplicate bankTransactionId:', bankTxId)
      return NextResponse.json({ success: true, message: 'Already processed (duplicate txId)' })
    }

    // Extract transfer code from content
    const content = String(body.content || body.description || '').toUpperCase()

    // Try to match an ORDER number (MUS-...)
    const orderMatch = content.match(/\b(MUS-[A-Z0-9]+-[A-Z0-9]+)\b/)
    if (orderMatch) {
      const orderNumber = orderMatch[0]
      console.log('[Sepay Webhook] Detected order number:', orderNumber)

      const orderResult = await payload.find({
        collection: 'orders',
        where: {
          orderNumber: { equals: orderNumber },
          status: { equals: 'pending' },
        },
        limit: 1,
        depth: 0,
      })

      if (orderResult.totalDocs > 0) {
        const order = orderResult.docs[0] as Order
        const tolerance = Math.min(5000, order.total * 0.1)
        if (amount < order.total - tolerance) {
          console.warn(`[Sepay Webhook] Order amount mismatch: received ${amount}, expected ${order.total}`)
          return NextResponse.json({ success: false, error: 'Amount too low for order' }, { status: 400 })
        }

        const result = await fulfillOrder(payload, order.id, {
          transactionId: bankTxId,
          paidAt: new Date().toISOString(),
          rawResponse: { gateway: body.gateway, bankTxId, amount, content },
        })

        console.log(`[Sepay Webhook] Order ${orderNumber} fulfilled. Token: ${result.downloadToken}`)
        try { revalidatePath('/', 'layout') } catch {}

        return NextResponse.json({
          success: true,
          message: 'Order fulfilled',
          orderNumber,
          downloadToken: result.downloadToken,
        })
      }
    }

    // Match NAPKH{userId} code — used for BOTH orders and topups
    const codeMatch = content.match(/\bNAPKH\d{4,}\b/)
    if (codeMatch) {
      const transferCode = codeMatch[0]
      console.log('[Sepay Webhook] Detected user transfer code:', transferCode)

      // Priority 1: Check for pending ORDER with this transferCode
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
          const result = await fulfillOrder(payload, order.id, {
            transactionId: bankTxId,
            paidAt: new Date().toISOString(),
            rawResponse: { gateway: body.gateway, bankTxId, amount, content },
          })

          console.log(`[Sepay Webhook] Order ${order.orderNumber} fulfilled via ${transferCode}. Token: ${result.downloadToken}`)
          try { revalidatePath('/', 'layout') } catch {}

          return NextResponse.json({
            success: true,
            message: 'Order fulfilled via transfer code',
            orderNumber: order.orderNumber,
            downloadToken: result.downloadToken,
          })
        }
        // Amount too low for order — fall through to credit as topup instead
        console.log(`[Sepay Webhook] Amount ${amount} too low for order ${order.orderNumber} (${order.total}), falling through to topup`)
      }

      // Priority 2: Fall through to topup logic below
    }

    // Try top-up code (NAP...)
    const topupCodeMatch = content.match(/\bNAP[A-Z0-9]{4,12}\b/)
    if (!topupCodeMatch) {
      console.log('[Sepay Webhook] No transfer code found in:', content)
      return NextResponse.json({ success: true, message: 'No matching transfer code' })
    }
    const topupTransferCode = topupCodeMatch[0]

    // Find pending top-up with this transfer code
    const topupResult = await payload.find({
      collection: 'topups',
      where: {
        transferCode: { equals: topupTransferCode },
        status: { equals: 'pending' },
      },
      limit: 1,
      depth: 1,
    })

    let topup: TopUp | null = null

    if (topupResult.totalDocs > 0) {
      topup = topupResult.docs[0] as TopUp
    } else {
      // No pending topup found — try fixed code pattern NAPKH{userId}
      const fixedMatch = topupTransferCode.match(/^NAPKH(\d+)$/)
      if (fixedMatch) {
        const extractedUserId = parseInt(fixedMatch[1], 10)
        console.log('[Sepay Webhook] Fixed code detected, userId:', extractedUserId)

        try {
          const targetUser = await payload.findByID({ collection: 'users', id: extractedUserId }) as User
          if (targetUser) {
            const newTopup = await payload.create({
              collection: 'topups',
              data: {
                user: extractedUserId,
                amount,
                transferCode: `${topupTransferCode}${Date.now().toString(36).slice(-4).toUpperCase()}`,
                status: 'completed',
                bankTransactionId: bankTxId,
                bankDescription: content,
                confirmedAt: new Date().toISOString(),
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

            console.log(`[Sepay Webhook] Auto-credited ${amount} VND to user ${extractedUserId} via fixed code. New balance: ${currentBalance + amount}`)
            try { revalidatePath('/', 'layout') } catch {}

            return NextResponse.json({
              success: true,
              message: 'Top-up auto-created and credited via fixed code',
              topupId: newTopup.id,
              creditedAmount: amount,
            })
          }
        } catch {
          console.log('[Sepay Webhook] User not found for fixed code userId:', extractedUserId)
        }
      }

      console.log('[Sepay Webhook] No pending topup for code:', topupTransferCode)
      return NextResponse.json({ success: true, message: 'No matching pending topup' })
    }

    // Verify amount (allow flat fee tolerance of max 5,000 VND for bank fees)
    const tolerance = Math.min(5000, topup.amount * 0.1)
    if (amount < topup.amount - tolerance) {
      console.warn(`[Sepay Webhook] Amount too low: received ${amount}, expected ${topup.amount}`)
      return NextResponse.json({ success: false, error: 'Amount too low' }, { status: 400 })
    }

    // ATOMIC: Conditionally update only if still pending (prevents double-credit)
    const freshTopup = await payload.findByID({ collection: 'topups', id: topup.id }) as TopUp
    if (freshTopup.status !== 'pending') {
      console.log('[Sepay Webhook] Topup already processed:', topup.id)
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    // Mark top-up as completed immediately to prevent concurrent processing
    await payload.update({
      collection: 'topups',
      id: topup.id,
      data: {
        status: 'completed',
        bankTransactionId: bankTxId,
        bankDescription: content,
        confirmedAt: new Date().toISOString(),
      },
    })

    // Credit user balance
    const userId = typeof topup.user === 'object' ? topup.user.id : topup.user
    const currentUser = await payload.findByID({ collection: 'users', id: userId }) as User
    const currentBalance = currentUser.balance || 0
    const creditAmount = Math.min(amount, topup.amount)

    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        balance: currentBalance + creditAmount,
      },
      overrideAccess: true,
    })

    console.log(`[Sepay Webhook] Credited ${creditAmount} VND to user ${userId}. New balance: ${currentBalance + creditAmount}`)

    try { revalidatePath('/', 'layout') } catch {}

    return NextResponse.json({
      success: true,
      message: 'Top-up confirmed',
      topupId: topup.id,
      creditedAmount: creditAmount,
    })
  } catch (error) {
    console.error('[Sepay Webhook] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/** GET: Health check for webhook endpoint */
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'bank-transfer-webhook' })
}
