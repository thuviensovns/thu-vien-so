import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

const VN_TZ = 'Asia/Ho_Chi_Minh'
const TS_EXPR = `(COALESCE(orig.credited_at, orig.confirmed_at, orig.created_at, t.credited_at, t.confirmed_at, t.created_at) AT TIME ZONE '${VN_TZ}')`

console.log('\n--- Daily revenue T4/2026 (with original_topup_id linkage) ---')
const r = await c.query(`
  SELECT EXTRACT(DAY FROM ${TS_EXPR})::int AS day,
         SUM(t.amount)::bigint AS amount,
         COUNT(*)::int AS count
  FROM topups t
  LEFT JOIN topups orig ON orig.id = t.original_topup_id
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
    AND EXTRACT(YEAR FROM ${TS_EXPR}) = 2026
    AND EXTRACT(MONTH FROM ${TS_EXPR}) = 4
  GROUP BY day
  ORDER BY day
`)
console.table(r.rows.map(x => ({ day: x.day, amount: Number(x.amount).toLocaleString('vi-VN'), count: Number(x.count) })))

console.log('\n--- Today net (should be positive now, DEDUCT moved away) ---')
const today = await c.query(`
  SELECT COALESCE(SUM(t.amount), 0)::bigint AS amount, COUNT(*)::int AS count
  FROM topups t
  LEFT JOIN topups orig ON orig.id = t.original_topup_id
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
    AND DATE(${TS_EXPR}) = (CURRENT_TIMESTAMP AT TIME ZONE '${VN_TZ}')::date
`)
console.table(today.rows.map(r => ({ today_amount: Number(r.amount).toLocaleString('vi-VN'), count: Number(r.count) })))

console.log('\n--- All-time totals ---')
const all = await c.query(`
  SELECT COALESCE(SUM(t.amount), 0)::bigint AS amount, COUNT(*)::int AS count
  FROM topups t
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
`)
console.table(all.rows.map(r => ({ total: Number(r.amount).toLocaleString('vi-VN'), count: Number(r.count) })))

await c.end()
