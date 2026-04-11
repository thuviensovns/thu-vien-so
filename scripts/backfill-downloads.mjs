/**
 * Backfill downloads collection from existing paid orders.
 * Run once locally (against shared Neon) after deploying the fulfillOrder fix.
 */
import { readFileSync } from 'fs'
import pg from 'pg'

const envText = readFileSync('.env.local', 'utf8')
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1]
const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

const REDOWNLOAD_EXPIRY_DAYS = 365
const REDOWNLOAD_MAX = 10

// Get all paid orders with their items
const { rows: orders } = await client.query(
  `SELECT id, order_number, user_id, created_at FROM orders WHERE status = 'paid' ORDER BY id`,
)
console.log(`Paid orders: ${orders.length}`)

let created = 0
let skipped = 0
let errors = 0

for (const order of orders) {
  // orders_items table: _parent_id -> order.id, product_id
  const { rows: items } = await client.query(
    `SELECT product_id FROM orders_items WHERE _parent_id = $1 AND product_id IS NOT NULL`,
    [order.id],
  )

  for (const item of items) {
    // Check if download record already exists for (order, product)
    const { rows: existing } = await client.query(
      `SELECT id FROM downloads WHERE order_id = $1 AND product_id = $2 LIMIT 1`,
      [order.id, item.product_id],
    )
    if (existing.length > 0) {
      skipped++
      continue
    }

    const expiresAt = new Date(order.created_at)
    expiresAt.setDate(expiresAt.getDate() + REDOWNLOAD_EXPIRY_DAYS)

    try {
      await client.query(
        `INSERT INTO downloads (user_id, order_id, product_id, download_count, max_downloads, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, 0, $4, $5, NOW(), NOW())`,
        [order.user_id, order.id, item.product_id, REDOWNLOAD_MAX, expiresAt.toISOString()],
      )
      created++
    } catch (e) {
      console.error(`[order ${order.order_number}] INSERT failed for product ${item.product_id}:`, e.message)
      errors++
    }
  }
}

console.log(`\nBackfill done: created=${created} skipped=${skipped} errors=${errors}`)

const { rows: total } = await client.query(`SELECT COUNT(*)::int AS n FROM downloads`)
console.log(`Total downloads rows: ${total[0].n}`)

await client.end()
