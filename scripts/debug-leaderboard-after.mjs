import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

console.log('\n--- Leaderboard simulation (post-fix: excludes DEDUCT* and COMM*) ---')
const lb = await c.query(`
  SELECT u.id, u.email, SUM(t.amount)::bigint AS total
  FROM topups t JOIN users u ON u.id = t.user_id
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR (t.transfer_code NOT LIKE 'DEDUCT%' AND t.transfer_code NOT LIKE 'COMM%'))
    AND u.role='customer'
    AND u.email NOT LIKE 'test-%' AND u.email NOT LIKE '%test@%' AND u.email NOT LIKE '%@example.com'
    AND t.created_at >= date_trunc('month', CURRENT_DATE)
    AND t.created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
  GROUP BY u.id, u.email
  HAVING SUM(t.amount) > 0
  ORDER BY total DESC
  LIMIT 10
`)
console.table(lb.rows.map((x, i) => ({ rank: i + 1, id: x.id, email: x.email, total: Number(x.total) })))

console.log('\n--- topUpTotal (admin dashboard) — gross only ---')
const total = await c.query(`
  SELECT COALESCE(SUM(t.amount), 0)::bigint AS total, COUNT(*)::int AS cnt
  FROM topups t
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR (t.transfer_code NOT LIKE 'DEDUCT%' AND t.transfer_code NOT LIKE 'COMM%'))
`)
console.table(total.rows.map(r => ({ total: Number(r.total), count: Number(r.cnt) })))

await c.end()
