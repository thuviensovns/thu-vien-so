import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

console.log('\n--- Topup completed split by kind ---')
const split = await c.query(`
  SELECT
    CASE
      WHEN transfer_code LIKE 'DEDUCT%' THEN 'DEDUCT (admin trừ)'
      WHEN transfer_code LIKE 'COMM%' THEN 'COMM (affiliate)'
      WHEN transfer_code LIKE 'ADMIN%' THEN 'ADMIN (admin cộng tay)'
      ELSE 'REAL (bank deposit)'
    END AS kind,
    COUNT(*)::int AS cnt,
    SUM(amount)::bigint AS sum,
    MIN(amount)::bigint AS min_amt,
    MAX(amount)::bigint AS max_amt
  FROM topups WHERE status='completed' GROUP BY kind ORDER BY kind
`)
console.table(split.rows)

console.log('\n--- ADMIN* rows preview ---')
const admin = await c.query(`SELECT id, user_id, amount, transfer_code, bank_description, created_at FROM topups WHERE transfer_code LIKE 'ADMIN%' ORDER BY created_at DESC LIMIT 20`)
console.table(admin.rows.map(x => ({ id: x.id, user: x.user_id, amount: Number(x.amount), code: x.transfer_code, desc: (x.bank_description || '').slice(0, 60), date: new Date(x.created_at).toISOString().slice(0,10) })))

console.log('\n--- Real revenue (bank deposits only) ---')
const real = await c.query(`
  SELECT COALESCE(SUM(t.amount), 0)::bigint AS total, COUNT(*)::int AS cnt
  FROM topups t
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR (t.transfer_code NOT LIKE 'DEDUCT%' AND t.transfer_code NOT LIKE 'COMM%' AND t.transfer_code NOT LIKE 'ADMIN%'))
`)
console.table(real.rows.map(r => ({ total: Number(r.total), count: Number(r.cnt) })))

await c.end()
