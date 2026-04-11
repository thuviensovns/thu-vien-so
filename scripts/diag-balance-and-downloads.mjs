/**
 * Diagnostic: audit balance sanity + duplicate downloads on production DB.
 *
 * 1. For each user: compute expected balance =
 *      sum(topups.amount where status=completed) - sum(orders.total where status=paid and payment_method=balance)
 *    Compare to users.balance. Print mismatches.
 * 2. Count duplicate downloads rows per (user, product). Print groups > 1.
 */
import { readFileSync } from 'fs'
import pg from 'pg'

const envText = readFileSync('.env.local', 'utf8')
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1]
const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

console.log('\n===== 1. BALANCE AUDIT =====')
const { rows: users } = await client.query(
  `SELECT id, email, balance FROM users ORDER BY id`,
)

for (const u of users) {
  const { rows: [credit] } = await client.query(
    `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM topups WHERE user_id = $1 AND status = 'completed'`,
    [u.id],
  )
  const { rows: [spent] } = await client.query(
    `SELECT COALESCE(SUM(total), 0)::bigint AS total FROM orders WHERE user_id = $1 AND status = 'paid' AND payment_method = 'balance'`,
    [u.id],
  )
  const expected = Number(credit.total) - Number(spent.total)
  const actual = Number(u.balance || 0)
  const diff = actual - expected
  const flag = diff === 0 ? 'OK ' : (diff < 0 ? 'LOSS' : 'GAIN')
  if (diff !== 0 || Number(credit.total) > 0) {
    console.log(`[${flag}] user=${u.id} ${u.email} credited=${credit.total} spent=${spent.total} expected=${expected} actual=${actual} diff=${diff}`)
  }
}

console.log('\n===== 2. DUPLICATE DOWNLOADS =====')
const { rows: dupes } = await client.query(
  `SELECT user_id, product_id, COUNT(*)::int AS n, array_agg(id ORDER BY id) AS ids
   FROM downloads
   GROUP BY user_id, product_id
   HAVING COUNT(*) > 1
   ORDER BY n DESC`,
)
if (dupes.length === 0) {
  console.log('No duplicates found.')
} else {
  console.log(`Found ${dupes.length} (user, product) groups with duplicates:`)
  for (const d of dupes) {
    console.log(`  user=${d.user_id} product=${d.product_id} count=${d.n} ids=[${d.ids.join(',')}]`)
  }
}

console.log('\n===== 3. ORDER STATUS HISTOGRAM =====')
const { rows: histo } = await client.query(
  `SELECT status, payment_method, COUNT(*)::int AS n FROM orders GROUP BY status, payment_method ORDER BY status, payment_method`,
)
console.table(histo)

console.log('\n===== 4. ORPHAN "processing" ORDERS (may indicate failed pay-with-balance) =====')
const { rows: procs } = await client.query(
  `SELECT id, order_number, user_id, total, created_at FROM orders WHERE status = 'processing' ORDER BY id`,
)
if (procs.length === 0) {
  console.log('None.')
} else {
  console.table(procs)
}

await client.end()
