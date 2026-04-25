import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

console.log('\n--- DEDUCT topup rows (top 20 most recent) ---')
const r = await c.query(`SELECT id, user_id, amount, transfer_code, status, bank_description, created_at FROM topups WHERE transfer_code LIKE 'DEDUCT%' ORDER BY created_at DESC LIMIT 20`)
console.table(r.rows.map(x => ({ id: x.id, user: x.user_id, amount: x.amount, code: x.transfer_code, status: x.status, desc: (x.bank_description || '').slice(0, 60) })))

console.log(`\n--- Aggregate stats by kind (status=completed) ---`)
const stats = await c.query(`
  SELECT
    CASE
      WHEN transfer_code LIKE 'DEDUCT%' THEN 'DEDUCT'
      WHEN transfer_code LIKE 'COMM%' THEN 'COMM'
      ELSE 'REAL'
    END AS kind,
    COUNT(*)::int AS cnt,
    SUM(amount)::bigint AS sum,
    MIN(amount)::bigint AS min_amt,
    MAX(amount)::bigint AS max_amt
  FROM topups WHERE status='completed' GROUP BY kind ORDER BY kind
`)
console.table(stats.rows)

console.log('\n--- Current leaderboard (this month) showing distortion ---')
const lb = await c.query(`
  SELECT
    u.id, u.email,
    SUM(t.amount)::bigint AS total_signed,
    SUM(CASE WHEN t.transfer_code LIKE 'DEDUCT%' THEN t.amount ELSE 0 END)::bigint AS deduct_inflated,
    SUM(CASE WHEN t.transfer_code NOT LIKE 'DEDUCT%' AND t.transfer_code NOT LIKE 'COMM%' THEN t.amount ELSE 0 END)::bigint AS real_only
  FROM topups t JOIN users u ON u.id = t.user_id
  WHERE t.status = 'completed'
    AND u.role = 'customer'
    AND t.created_at >= date_trunc('month', CURRENT_DATE)
    AND t.created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
  GROUP BY u.id, u.email
  HAVING SUM(t.amount) > 0
  ORDER BY total_signed DESC
  LIMIT 10
`)
console.table(lb.rows.map(x => ({ id: x.id, email: x.email, current: Number(x.total_signed), inflated_by_deducts: Number(x.deduct_inflated), real_only: Number(x.real_only) })))

await c.end()
