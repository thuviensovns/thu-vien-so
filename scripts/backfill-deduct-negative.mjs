import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

console.log('\n--- BEFORE backfill ---')
const before = await c.query(`SELECT id, user_id, amount, transfer_code, bank_description FROM topups WHERE transfer_code LIKE 'DEDUCT%' ORDER BY created_at DESC`)
console.table(before.rows.map(x => ({ id: x.id, user: x.user_id, amount: Number(x.amount), code: x.transfer_code })))

console.log('\n--- Running backfill: flip positive DEDUCT amounts to negative ---')
const upd = await c.query(`UPDATE topups SET amount = -amount WHERE transfer_code LIKE 'DEDUCT%' AND amount > 0`)
console.log(`Updated ${upd.rowCount} rows`)

console.log('\n--- AFTER backfill ---')
const after = await c.query(`SELECT id, user_id, amount, transfer_code FROM topups WHERE transfer_code LIKE 'DEDUCT%' ORDER BY created_at DESC`)
console.table(after.rows.map(x => ({ id: x.id, user: x.user_id, amount: Number(x.amount), code: x.transfer_code })))

console.log('\n--- New leaderboard preview (this month, with HAVING > 0) ---')
const lb = await c.query(`
  SELECT u.id, u.email, SUM(t.amount)::bigint AS net_total
  FROM topups t JOIN users u ON u.id = t.user_id
  WHERE t.status='completed'
    AND u.role='customer'
    AND u.email NOT LIKE 'test-%' AND u.email NOT LIKE '%test@%' AND u.email NOT LIKE '%@example.com'
    AND t.created_at >= date_trunc('month', CURRENT_DATE)
    AND t.created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
  GROUP BY u.id, u.email
  HAVING SUM(t.amount) > 0
  ORDER BY net_total DESC
  LIMIT 10
`)
console.table(lb.rows.map(x => ({ id: x.id, email: x.email, net_total: Number(x.net_total) })))

await c.end()
