import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const r = await c.query(`SELECT status, COUNT(*)::int AS cnt, COALESCE(SUM(total),0)::bigint AS sum FROM orders GROUP BY status ORDER BY status`)
console.log('--- Orders by status ---')
console.table(r.rows.map(x => ({ status: x.status, count: x.cnt, total_VND: Number(x.sum).toLocaleString('vi-VN') })))

const rp = await c.query(`SELECT oi.product_name, COUNT(*)::int AS cnt, COALESCE(SUM(oi.price),0)::bigint AS revenue FROM orders_items oi JOIN orders o ON o.id = oi._parent_id WHERE o.status='paid' GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 10`)
console.log('\n--- Top 10 products by paid revenue (all-time) ---')
console.table(rp.rows.map(x => ({ name: (x.product_name||'').slice(0,50), units: x.cnt, revenue: Number(x.revenue).toLocaleString('vi-VN') })))

const today = await c.query(`
  SELECT oi.product_name, COUNT(*)::int AS units, COALESCE(SUM(oi.price),0)::bigint AS revenue
  FROM orders_items oi
  JOIN orders o ON o.id = oi._parent_id
  WHERE o.status='paid'
    AND DATE(COALESCE(o.payment_paid_at, o.created_at) AT TIME ZONE 'Asia/Ho_Chi_Minh') = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  GROUP BY oi.product_name
  ORDER BY revenue DESC
`)
console.log('\n--- Products sold TODAY (paid) ---')
console.table(today.rows.map(x => ({ name: (x.product_name||'').slice(0,50), units: x.units, revenue: Number(x.revenue).toLocaleString('vi-VN') })))

await c.end()
