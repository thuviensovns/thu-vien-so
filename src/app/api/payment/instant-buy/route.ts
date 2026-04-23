import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { randomUUID } from 'crypto'
import { getDbPool } from '@/lib/db-pool'
import { verifyPayloadJwt } from '@/lib/verify-payload-jwt'
import { generateOrderNumber } from '@/lib/payment'
import { getUserTransferCode } from '@/lib/config'
import { generateDownloadUrl } from '@/lib/r2'
import { normalizeDownloadUrl } from '@/lib/normalize-download-url'

export const maxDuration = 30

const DOWNLOAD_EXPIRY_HOURS = 72
const REDOWNLOAD_EXPIRY_DAYS = 365
const REDOWNLOAD_MAX_COUNT = 10

/**
 * Hot-path balance checkout — raw SQL end-to-end. Previously this route
 * went through Payload for auth + 4 CRUD calls, which ate 500-1500ms on
 * cold starts and 400-600ms warm. The raw-SQL flow drops the Payload init
 * entirely on the critical path (JWT verified locally, pg pool for all
 * reads/writes) and targets ~150-300ms warm.
 *
 *   1. JWT verify from payload-token cookie (no DB)
 *   2. parallel(users SELECT, products SELECT)  — 1 DB roundtrip
 *   3. BEGIN … INSERT orders; INSERT orders_items; UPDATE users; COMMIT
 *   4. Sign R2 URLs inline (local HMAC)
 *   5. Response
 *
 * Everything non-essential (downloads-collection upsert, product
 * downloadCount bumps, revalidatePath) runs in `after()` via Payload so it
 * never blocks the customer's response.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. AUTH — verify JWT ourselves; skips Payload bootstrap entirely
    const cookieToken = req.cookies.get('payload-token')?.value
    const secret = process.env.PAYLOAD_SECRET
    if (!cookieToken || !secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const jwt = verifyPayloadJwt(cookieToken, secret)
    if (!jwt) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = jwt.id

    // 2. VALIDATE BODY
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
    const productIds: number[] = []
    for (const item of items) {
      const pidStr = typeof item?.productId === 'string' ? item.productId.trim() : ''
      const pid = Number(pidStr)
      if (!pidStr || !Number.isFinite(pid) || pid <= 0 || pid > 2_147_483_647) {
        return NextResponse.json({ error: 'Invalid productId in items' }, { status: 400 })
      }
      productIds.push(pid)
    }

    const pool = getDbPool()

    // 3. PARALLEL READS — user + products in one roundtrip
    interface UserRow { balance: string | number; banned: boolean | null; email: string; display_name: string | null }
    interface ProductRow {
      id: number
      name: string
      pricing_price: string | number
      file_r2_key: string | null
      file_download_url: string | null
      file_file_name: string | null
      file_file_size: string | number | null
      file_file_format: string | null
    }

    const [userRes, productsRes] = await Promise.all([
      pool.query(
        `SELECT balance, banned, email, display_name FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      ) as Promise<{ rows: UserRow[] }>,
      pool.query(
        `SELECT id, name, pricing_price,
                file_r2_key, file_download_url,
                file_file_name, file_file_size, file_file_format
         FROM products WHERE id = ANY($1::int[])`,
        [productIds],
      ) as Promise<{ rows: ProductRow[] }>,
    ])

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }
    const userRow = userRes.rows[0]
    if (userRow.banned) {
      return NextResponse.json({ error: 'Account banned' }, { status: 403 })
    }
    const balance = Number(userRow.balance || 0)

    // Preserve input order (ANY() doesn't preserve it)
    const productsById = new Map<number, ProductRow>(
      productsRes.rows.map((r: ProductRow) => [Number(r.id), r]),
    )
    const products: ProductRow[] = []
    for (const pid of productIds) {
      const row = productsById.get(pid)
      if (!row) {
        return NextResponse.json({ error: 'Product not found' }, { status: 400 })
      }
      products.push(row)
    }

    let total = 0
    for (const p of products) total += Number(p.pricing_price)
    if (total <= 0) {
      return NextResponse.json({ error: 'Invalid order total' }, { status: 400 })
    }
    if (balance < total) {
      return NextResponse.json({
        error: `Số dư không đủ. Cần ${total}, hiện có ${balance}`,
      }, { status: 400 })
    }

    // 4. Generate identifiers locally — no DB hit
    const orderNumber = generateOrderNumber()
    const downloadToken = randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + DOWNLOAD_EXPIRY_HOURS * 3600 * 1000)
    const transferCode = getUserTransferCode(userId)

    // 5. TRANSACTION — single atomic write for order, items, and balance.
    // `balance - $1 WHERE balance >= $1` is conditional: if another charge
    // landed between our SELECT and UPDATE the row won't match and we roll
    // the whole transaction back. No over-deduction under concurrency.
    const client = await pool.connect()
    let orderId: number
    try {
      await client.query('BEGIN')

      const orderInsertRes = (await client.query(
        `INSERT INTO orders (
          order_number, user_id, total, status,
          payment_method, payment_paid_at,
          download_token, download_expires_at,
          transfer_code, customer_email, customer_name,
          read_by_admin,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'paid',
          'balance', $4,
          $5, $6,
          $7, $8, $9,
          false,
          NOW(), NOW()
        ) RETURNING id`,
        [
          orderNumber, userId, total, now,
          downloadToken, expiresAt,
          transferCode, userRow.email || '', userRow.display_name || '',
        ],
      )) as { rows: Array<{ id: number }> }
      orderId = Number(orderInsertRes.rows[0].id)

      const placeholders: string[] = []
      const values: unknown[] = []
      products.forEach((p, i) => {
        const b = i * 6
        placeholders.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`)
        values.push(
          randomUUID(),            // orders_items.id is varchar — generate a stable UUID
          orderId,
          i,
          Number(p.id),
          Number(p.pricing_price),
          String(p.name),
        )
      })
      await client.query(
        `INSERT INTO orders_items (id, _parent_id, _order, product_id, price, product_name)
         VALUES ${placeholders.join(', ')}`,
        values,
      )

      const deductRes = await client.query(
        `UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1`,
        [total, userId],
      )
      if (deductRes.rowCount === 0) {
        throw new Error('Insufficient balance at write time')
      }

      await client.query('COMMIT')
    } catch (txErr) {
      try { await client.query('ROLLBACK') } catch {}
      console.error('[Instant Buy] transaction failed:', txErr)
      return NextResponse.json({
        error: 'Không thể hoàn tất đơn hàng. Vui lòng thử lại.',
      }, { status: 500 })
    } finally {
      client.release()
    }

    // 6. Sign R2 URLs inline so the result page has everything it needs
    // without a follow-up /api/download/[token] round-trip.
    const downloadItems = await Promise.all(products.map(async (p) => {
      let url: string | null = null
      if (p.file_r2_key) {
        try { url = await generateDownloadUrl(p.file_r2_key, 3600) } catch (e) {
          console.error('[Instant Buy] R2 signing failed:', e)
        }
      } else if (p.file_download_url) {
        url = normalizeDownloadUrl(p.file_download_url)
      }
      return {
        productId: Number(p.id),
        name: String(p.name),
        hasFile: !!(p.file_r2_key || p.file_download_url),
        fileName: p.file_file_name || null,
        fileSize: p.file_file_size ? Number(p.file_file_size) : null,
        fileFormat: p.file_file_format || null,
        url,
      }
    }))

    // 7. SIDE EFFECTS — run after response is sent. Downloads-collection
    // upsert powers /tai-khoan's re-download UI; neither it nor the
    // product downloadCount bump gate the customer's access (the order's
    // downloadToken is the only authorization the /api/download/[token]
    // endpoint checks).
    const redownloadExpiresAt = new Date(Date.now() + REDOWNLOAD_EXPIRY_DAYS * 24 * 3600 * 1000).toISOString()
    after(async () => {
      // Bump product.download_count via raw SQL (fast, no Payload init)
      try {
        await pool.query(
          `UPDATE products SET download_count = COALESCE(download_count, 0) + 1
           WHERE id = ANY($1::int[])`,
          [productIds],
        )
      } catch (e) {
        console.error('[Instant Buy after] downloadCount bump failed:', e)
      }

      // Upsert the re-download records. Payload here is fine because it
      // owns the `downloads` collection's field normalization; and since
      // this runs after the response, cold init cost doesn't hit the user.
      try {
        const { getPayloadForApi } = await import('@/lib/payload')
        const payload = await getPayloadForApi()
        await Promise.allSettled(productIds.map(async (productId) => {
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
                  user: userId,
                  order: orderId,
                  product: productId,
                  downloadCount: 0,
                  maxDownloads: REDOWNLOAD_MAX_COUNT,
                  expiresAt: redownloadExpiresAt,
                },
                overrideAccess: true,
              })
            } else {
              await payload.update({
                collection: 'downloads',
                id: existing.docs[0].id,
                data: {
                  order: orderId,
                  downloadCount: 0,
                  maxDownloads: REDOWNLOAD_MAX_COUNT,
                  expiresAt: redownloadExpiresAt,
                },
                overrideAccess: true,
              })
            }
          } catch (e) {
            console.error(`[Instant Buy after] downloads upsert failed (product ${productId}):`, e)
          }
        }))
      } catch (e) {
        console.error('[Instant Buy after] Payload init failed:', e)
      }

      try {
        const { revalidatePath } = await import('next/cache')
        revalidatePath('/', 'layout')
      } catch {}
    })

    return NextResponse.json({
      success: true,
      orderId,
      orderNumber,
      downloadToken,
      newBalance: balance - total,
      downloadItems,
    })
  } catch (error) {
    console.error('[Instant Buy] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
