import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { revalidatePath } from 'next/cache'

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

    let body: any
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

    // Extract transfer code from content (word-boundary match)
    const content = String(body.content || body.description || '').toUpperCase()
    const codeMatch = content.match(/\bNAP[A-Z0-9]{4,12}\b/)
    if (!codeMatch) {
      console.log('[Sepay Webhook] No transfer code found in:', content)
      return NextResponse.json({ success: true, message: 'No matching transfer code' })
    }
    const transferCode = codeMatch[0]

    // Find pending top-up with this transfer code
    const result = await payload.find({
      collection: 'topups',
      where: {
        transferCode: { equals: transferCode },
        status: { equals: 'pending' },
      },
      limit: 1,
      depth: 1,
    })

    if (result.totalDocs === 0) {
      console.log('[Sepay Webhook] No pending topup for code:', transferCode)
      return NextResponse.json({ success: true, message: 'No matching pending topup' })
    }

    const topup = result.docs[0] as any

    // Verify amount (allow flat fee tolerance of max 5,000 VND for bank fees)
    const tolerance = Math.min(5000, topup.amount * 0.1)
    if (amount < topup.amount - tolerance) {
      console.warn(`[Sepay Webhook] Amount too low: received ${amount}, expected ${topup.amount}`)
      return NextResponse.json({ success: false, error: 'Amount too low' }, { status: 400 })
    }

    // ATOMIC: Conditionally update only if still pending (prevents double-credit)
    // Payload doesn't support WHERE in update, so we re-check status right before update
    const freshTopup = await payload.findByID({ collection: 'topups', id: topup.id })
    if ((freshTopup as any).status !== 'pending') {
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
    const currentUser = await payload.findByID({ collection: 'users', id: userId })
    const currentBalance = (currentUser as any).balance || 0
    const creditAmount = Math.min(amount, topup.amount)

    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        balance: currentBalance + creditAmount,
      } as any,
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
