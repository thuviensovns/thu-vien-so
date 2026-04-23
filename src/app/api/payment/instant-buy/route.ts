import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { randomUUID } from 'crypto'
import { getPayloadForApi } from '@/lib/payload'
import { generateOrderNumber } from '@/lib/payment'
import { getUserTransferCode } from '@/lib/config'
import { revalidatePath } from 'next/cache'
import type { User, Product } from '@/types/payload-types'

export const maxDuration = 30

const DOWNLOAD_EXPIRY_HOURS = 72
const REDOWNLOAD_EXPIRY_DAYS = 365
const REDOWNLOAD_MAX_COUNT = 10

/**
 * Buy-with-balance hot path — tuned for 2-3s perceived wait on the "Mua ngay"
 * flow. The critical path (what the client waits on) does:
 *   1. auth
 *   2. parallel(product lookups, user read)  — 1 DB roundtrip
 *   3. 1 order create (status=paid, downloadToken set)
 *   4. 1 user update (balance deduction)
 * Everything else (download records, product.downloadCount bumps,
 * revalidatePath) is fire-and-forget via `after()` so it doesn't block the
 * response. Down from ~9 sequential DB roundtrips to 3.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { items?: Array<{ productId: string }> }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const items = body?.items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }
    if (items.length > 50) {
      return NextResponse.json({ error: 'Too many items' }, { status: 400 })
    }
    for (const item of items) {
      const pid = typeof item?.productId === 'string' ? item.productId.trim() : ''
      if (!pid || pid.length > 100 || /[<>"';]/.test(pid)) {
        return NextResponse.json({ error: 'Invalid productId in items' }, { status: 400 })
      }
    }

    // Parallel reads — products + user balance in one DB roundtrip instead of two
    const [productResults, freshUser] = await Promise.all([
      Promise.all(items.map((item) =>
        payload.findByID({ collection: 'products', id: item.productId }).catch(() => null),
      )),
      payload.findByID({ collection: 'users', id: user.id }) as Promise<User>,
    ])

    const orderItems: Array<{ product: number | string; price: number; productName: string }> = []
    let total = 0
    for (let i = 0; i < items.length; i++) {
      const p = productResults[i] as Product | null
      if (!p) {
        return NextResponse.json({ error: 'Product not found' }, { status: 400 })
      }
      const price = p.pricing.price
      total += price
      orderItems.push({ product: p.id, price, productName: p.name })
    }

    if (total <= 0) {
      return NextResponse.json({ error: 'Invalid order total' }, { status: 400 })
    }

    const currentBalance = freshUser.balance || 0
    if (currentBalance < total) {
      return NextResponse.json({
        error: `Số dư không đủ. Cần ${total}, hiện có ${currentBalance}`,
      }, { status: 400 })
    }

    // Generate identifiers locally — no DB hit
    const orderNumber = generateOrderNumber()
    const downloadToken = randomUUID()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + DOWNLOAD_EXPIRY_HOURS)
    const downloadExpiresAt = expiresAt.toISOString()
    const paidAt = new Date().toISOString()

    // Create order directly in 'paid' state with downloadToken — collapses the
    // old pending→processing→paid three-write dance into a single INSERT.
    // Safe because the token is server-only until we respond; nobody can
    // download with it before the balance deduction below.
    const orderData: Record<string, unknown> = {
      orderNumber,
      user: user.id,
      items: orderItems,
      total,
      status: 'paid',
      downloadToken,
      downloadExpiresAt,
      payment: { method: 'balance', paidAt },
      customerEmail: user.email,
      transferCode: getUserTransferCode(user.id),
      customerName: (user as Record<string, unknown>).displayName || '',
      customerPhone: '',
    }

    let order
    try {
      order = await payload.create({ collection: 'orders', data: orderData })
    } catch (createErr) {
      // Schema-drift fallback — strip optional columns and retry
      const msg = (createErr as Error).message || ''
      if (/column|field|transfer|customer|read_by_admin|download_token|download_expires/i.test(msg)) {
        delete orderData.transferCode
        delete orderData.customerName
        delete orderData.customerPhone
        delete orderData.customerEmail
        try {
          order = await payload.create({ collection: 'orders', data: orderData })
        } catch {
          delete orderData.downloadToken
          delete orderData.downloadExpiresAt
          order = await payload.create({ collection: 'orders', data: orderData })
        }
      } else {
        throw createErr
      }
    }

    // Deduct balance. If it fails, flip order to 'failed' so the token can't
    // be used — /api/download/[token] rejects non-paid orders.
    try {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { balance: currentBalance - total },
        overrideAccess: true,
      })
    } catch (deductErr) {
      console.error('[Instant Buy] Balance deduction failed:', deductErr)
      try {
        await payload.update({
          collection: 'orders',
          id: order.id,
          data: { status: 'failed' },
          overrideAccess: true,
        })
      } catch (e) {
        console.error('[Instant Buy] CRITICAL: order revoke also failed:', e)
      }
      return NextResponse.json({
        error: 'Không thể trừ số dư. Vui lòng thử lại.',
      }, { status: 500 })
    }

    // Side effects — run after response is sent. None of these gate the
    // customer's ability to download (downloadToken on the order is the
    // only authorization the /api/download/[token] endpoint needs).
    const orderId = order.id
    const userId = user.id
    after(async () => {
      try { revalidatePath('/', 'layout') } catch {}

      const redownloadExpiresAt = new Date()
      redownloadExpiresAt.setDate(redownloadExpiresAt.getDate() + REDOWNLOAD_EXPIRY_DAYS)
      const redownloadExpiresAtIso = redownloadExpiresAt.toISOString()

      await Promise.allSettled(orderItems.map(async (item) => {
        const productId = item.product
        // Upsert /tai-khoan re-download record (dedupe by user+product)
        try {
          const existing = await payload.find({
            collection: 'downloads',
            where: {
              and: [
                { user: { equals: userId } },
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
                user: userId as number,
                order: orderId as number,
                product: productId as number,
                downloadCount: 0,
                maxDownloads: REDOWNLOAD_MAX_COUNT,
                expiresAt: redownloadExpiresAtIso,
              },
              overrideAccess: true,
            })
          } else {
            await payload.update({
              collection: 'downloads',
              id: existing.docs[0].id,
              data: {
                order: orderId as number,
                downloadCount: 0,
                maxDownloads: REDOWNLOAD_MAX_COUNT,
                expiresAt: redownloadExpiresAtIso,
              },
              overrideAccess: true,
            })
          }
        } catch (e) {
          console.error(`[Instant Buy after] Upsert download record failed (product ${productId}):`, e)
        }

        // Bump product.downloadCount (analytics)
        try {
          const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 }) as Product
          await payload.update({
            collection: 'products',
            id: productId,
            data: { downloadCount: (product.downloadCount || 0) + 1 },
            overrideAccess: true,
          })
        } catch (e) {
          console.error(`[Instant Buy after] downloadCount bump failed (product ${productId}):`, e)
        }
      }))
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber,
      downloadToken,
      newBalance: currentBalance - total,
    })
  } catch (error) {
    console.error('[Instant Buy] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
