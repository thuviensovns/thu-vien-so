import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

const VN_TZ = 'Asia/Ho_Chi_Minh'
const TS_EXPR = `(COALESCE(t.credited_at, t.confirmed_at, t.created_at) AT TIME ZONE '${VN_TZ}')`

console.log('\n--- Revenue (NEW: include ADMIN + DEDUCT auto-net, exclude COMM) ---\n')

const r = await c.query(`
  SELECT
    'Hôm nay' AS bucket,
    COALESCE(SUM(t.amount), 0)::bigint AS amount,
    COUNT(*)::int AS cnt
  FROM topups t
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
    AND DATE(${TS_EXPR}) = (CURRENT_TIMESTAMP AT TIME ZONE '${VN_TZ}')::date
  UNION ALL
  SELECT 'Tháng 4/2026', COALESCE(SUM(t.amount), 0)::bigint, COUNT(*)::int
  FROM topups t
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
    AND EXTRACT(YEAR FROM ${TS_EXPR}) = 2026
    AND EXTRACT(MONTH FROM ${TS_EXPR}) = 4
  UNION ALL
  SELECT 'Tất cả thời gian', COALESCE(SUM(t.amount), 0)::bigint, COUNT(*)::int
  FROM topups t
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
`)
console.table(r.rows.map(x => ({ bucket: x.bucket, amount_VND: Number(x.amount).toLocaleString('vi-VN'), count: Number(x.cnt) })))

console.log('\n--- Leaderboard (NEW: same filter) ---')
const lb = await c.query(`
  SELECT u.id, u.email, SUM(t.amount)::bigint AS net_total
  FROM topups t JOIN users u ON u.id = t.user_id
  WHERE t.status='completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
    AND u.role='customer'
    AND u.email NOT LIKE 'test-%' AND u.email NOT LIKE '%test@%' AND u.email NOT LIKE '%@example.com'
    AND t.created_at >= date_trunc('month', CURRENT_DATE)
    AND t.created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
  GROUP BY u.id, u.email
  HAVING SUM(t.amount) > 0
  ORDER BY net_total DESC
  LIMIT 10
`)
console.table(lb.rows.map((x, i) => ({ rank: i + 1, id: x.id, email: x.email, total: Number(x.net_total).toLocaleString('vi-VN') })))

console.log('\n--- Per-user breakdown for users with both ADMIN and DEDUCT (correction pairs) ---')
const corr = await c.query(`
  SELECT
    user_id,
    SUM(CASE WHEN transfer_code LIKE 'ADMIN%' THEN amount ELSE 0 END)::bigint AS admin_added,
    SUM(CASE WHEN transfer_code LIKE 'DEDUCT%' THEN amount ELSE 0 END)::bigint AS deduct_signed,
    SUM(CASE WHEN transfer_code NOT LIKE 'ADMIN%' AND transfer_code NOT LIKE 'DEDUCT%' AND transfer_code NOT LIKE 'COMM%' THEN amount ELSE 0 END)::bigint AS real_bank,
    SUM(CASE WHEN transfer_code NOT LIKE 'COMM%' OR transfer_code IS NULL THEN amount ELSE 0 END)::bigint AS net_total
  FROM topups
  WHERE status='completed'
  GROUP BY user_id
  HAVING SUM(CASE WHEN transfer_code LIKE 'DEDUCT%' THEN 1 ELSE 0 END) > 0
  ORDER BY net_total DESC
`)
console.table(corr.rows.map(x => ({
  user: x.user_id,
  admin_added: Number(x.admin_added).toLocaleString('vi-VN'),
  deduct: Number(x.deduct_signed).toLocaleString('vi-VN'),
  real_bank: Number(x.real_bank).toLocaleString('vi-VN'),
  net: Number(x.net_total).toLocaleString('vi-VN'),
})))

await c.end()
