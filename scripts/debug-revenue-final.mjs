import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

const VN_TZ = 'Asia/Ho_Chi_Minh'
const TS_EXPR = `(COALESCE(t.credited_at, t.confirmed_at, t.created_at) AT TIME ZONE '${VN_TZ}')`

console.log('\n--- Real revenue (post-fix: excludes DEDUCT/ADMIN/COMM) ---\n')

const totals = await c.query(`
  SELECT
    'Today' AS bucket,
    COALESCE(SUM(t.amount), 0)::bigint AS amount,
    COUNT(*)::int AS cnt
  FROM topups t
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR (t.transfer_code NOT LIKE 'DEDUCT%' AND t.transfer_code NOT LIKE 'ADMIN%' AND t.transfer_code NOT LIKE 'COMM%'))
    AND DATE(${TS_EXPR}) = (CURRENT_TIMESTAMP AT TIME ZONE '${VN_TZ}')::date
  UNION ALL
  SELECT 'Tháng 4/2026' AS bucket, COALESCE(SUM(t.amount), 0)::bigint, COUNT(*)::int
  FROM topups t
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR (t.transfer_code NOT LIKE 'DEDUCT%' AND t.transfer_code NOT LIKE 'ADMIN%' AND t.transfer_code NOT LIKE 'COMM%'))
    AND EXTRACT(YEAR FROM ${TS_EXPR}) = 2026
    AND EXTRACT(MONTH FROM ${TS_EXPR}) = 4
  UNION ALL
  SELECT 'Cả năm 2026', COALESCE(SUM(t.amount), 0)::bigint, COUNT(*)::int
  FROM topups t
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR (t.transfer_code NOT LIKE 'DEDUCT%' AND t.transfer_code NOT LIKE 'ADMIN%' AND t.transfer_code NOT LIKE 'COMM%'))
    AND EXTRACT(YEAR FROM ${TS_EXPR}) = 2026
  UNION ALL
  SELECT 'Tất cả thời gian', COALESCE(SUM(t.amount), 0)::bigint, COUNT(*)::int
  FROM topups t
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR (t.transfer_code NOT LIKE 'DEDUCT%' AND t.transfer_code NOT LIKE 'ADMIN%' AND t.transfer_code NOT LIKE 'COMM%'))
`)
console.table(totals.rows.map(r => ({ bucket: r.bucket, amount_VND: Number(r.amount).toLocaleString('vi-VN'), count: Number(r.cnt) })))

await c.end()
