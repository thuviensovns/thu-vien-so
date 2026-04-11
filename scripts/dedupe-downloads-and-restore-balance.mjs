/**
 * Dedupe downloads + restore missing balance for affected users.
 *
 * 1. Collapses duplicate (user, product) download rows: keeps the row with the
 *    latest expires_at and lowest downloadCount; deletes the others.
 * 2. Restores balance for users with confirmed losses (user 4 vungochieu0501 +10k,
 *    user 5 diep20923 +10k). See diag-balance-and-downloads.mjs output.
 */
import { readFileSync } from 'fs'
import pg from 'pg'

const envText = readFileSync('.env.local', 'utf8')
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1]
const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

console.log('\n===== DEDUPE DOWNLOADS =====')
const { rows: groups } = await client.query(
  `SELECT user_id, product_id, array_agg(id ORDER BY expires_at DESC NULLS LAST, download_count ASC, id DESC) AS ids
   FROM downloads
   WHERE user_id IS NOT NULL AND product_id IS NOT NULL
   GROUP BY user_id, product_id
   HAVING COUNT(*) > 1`,
)
console.log(`Duplicate groups: ${groups.length}`)

let totalDeleted = 0
for (const g of groups) {
  const keep = g.ids[0]
  const drop = g.ids.slice(1)
  console.log(`  user=${g.user_id} product=${g.product_id} keep=${keep} drop=[${drop.join(',')}]`)
  const { rowCount } = await client.query(
    `DELETE FROM downloads WHERE id = ANY($1::int[])`,
    [drop],
  )
  totalDeleted += rowCount || 0
}
console.log(`Total rows deleted: ${totalDeleted}`)

console.log('\n===== RESTORE BALANCE =====')
const restores = [
  { userId: 4, email: 'vungochieu0501@gmail.com', delta: 10000 },
  { userId: 5, email: 'diep20923@gmail.com', delta: 10000 },
]

for (const r of restores) {
  const { rows: [before] } = await client.query(`SELECT balance FROM users WHERE id = $1`, [r.userId])
  if (!before) {
    console.log(`  user ${r.userId} ${r.email}: NOT FOUND, skipping`)
    continue
  }
  const oldBal = Number(before.balance || 0)
  const newBal = oldBal + r.delta
  await client.query(`UPDATE users SET balance = $1, updated_at = NOW() WHERE id = $2`, [newBal, r.userId])
  console.log(`  user ${r.userId} ${r.email}: ${oldBal} -> ${newBal} (+${r.delta})`)

  // Create a topup record so future audits reconcile
  const transferCode = `RESTORE${r.userId}${Date.now().toString(36).toUpperCase()}`
  await client.query(
    `INSERT INTO topups (user_id, amount, transfer_code, status, confirmed_at, bank_description, created_at, updated_at)
     VALUES ($1, $2, $3, 'completed', NOW(), 'Auto-restore: balance loss from fulfillment bug (2026-04)', NOW(), NOW())`,
    [r.userId, r.delta, transferCode],
  )
}

console.log('\n===== FINAL DOWNLOADS COUNT =====')
const { rows: [cnt] } = await client.query(`SELECT COUNT(*)::int AS n FROM downloads`)
console.log(`Total downloads rows: ${cnt.n}`)

await client.end()
console.log('\nDone.')
