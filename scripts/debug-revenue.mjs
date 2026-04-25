import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const VN_TZ = 'Asia/Ho_Chi_Minh'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

const TS_EXPR = `(COALESCE(t.credited_at, t.confirmed_at, t.created_at) AT TIME ZONE '${VN_TZ}')`

const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: VN_TZ }))
const year = nowVN.getFullYear()
const month = nowVN.getMonth() + 1

console.log(`\n=== Revenue check (excludes COMM*) — year=${year} month=${month} ===\n`)

// Sanity: row count by status
const status = await c.query(`SELECT status, COUNT(*)::int AS c, SUM(amount)::bigint AS sum FROM topups GROUP BY status ORDER BY status`)
console.log('All topups by status:')
console.table(status.rows)

// Affiliate vs real
const split = await c.query(`
  SELECT
    CASE WHEN transfer_code LIKE 'COMM%' THEN 'COMM (affiliate)' ELSE 'Real' END AS kind,
    COUNT(*)::int AS c,
    SUM(amount)::bigint AS sum
  FROM topups
  WHERE status = 'completed'
  GROUP BY kind
`)
console.log('\nCompleted topups split:')
console.table(split.rows)

// Daily for current month
const daily = await c.query(`
  SELECT EXTRACT(DAY FROM ${TS_EXPR})::int AS day,
         SUM(t.amount)::bigint AS amount,
         COUNT(*)::int AS count
  FROM topups t
  WHERE t.status = 'completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
    AND EXTRACT(YEAR FROM ${TS_EXPR}) = $1
    AND EXTRACT(MONTH FROM ${TS_EXPR}) = $2
  GROUP BY day
  ORDER BY day
`, [year, month])
console.log(`\nDaily (${month}/${year}):`)
console.table(daily.rows)

// Monthly for current year
const monthly = await c.query(`
  SELECT EXTRACT(MONTH FROM ${TS_EXPR})::int AS month,
         SUM(t.amount)::bigint AS amount,
         COUNT(*)::int AS count
  FROM topups t
  WHERE t.status = 'completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
    AND EXTRACT(YEAR FROM ${TS_EXPR}) = $1
  GROUP BY month
  ORDER BY month
`, [year])
console.log(`\nMonthly (${year}):`)
console.table(monthly.rows)

// Yearly
const yearly = await c.query(`
  SELECT EXTRACT(YEAR FROM ${TS_EXPR})::int AS year,
         SUM(t.amount)::bigint AS amount,
         COUNT(*)::int AS count
  FROM topups t
  WHERE t.status = 'completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
  GROUP BY year
  ORDER BY year
`)
console.log('\nYearly:')
console.table(yearly.rows)

// Today
const today = await c.query(`
  SELECT COALESCE(SUM(t.amount), 0)::bigint AS amount,
         COUNT(*)::int AS count
  FROM topups t
  WHERE t.status = 'completed'
    AND (t.transfer_code IS NULL OR t.transfer_code NOT LIKE 'COMM%')
    AND DATE(${TS_EXPR}) = (CURRENT_TIMESTAMP AT TIME ZONE '${VN_TZ}')::date
`)
console.log('\nToday:')
console.table(today.rows)

await c.end()
