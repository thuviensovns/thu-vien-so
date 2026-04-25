import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const r = await c.query(`SELECT d.id AS deduct_id, d.user_id, d.amount AS deduct_amt, d.created_at AS deduct_date, o.id AS orig_id, o.transfer_code AS orig_code, o.amount AS orig_amt, o.created_at AS orig_date FROM topups d LEFT JOIN topups o ON o.id = d.original_topup_id WHERE d.transfer_code LIKE 'DEDUCT%' ORDER BY d.id`)
console.table(r.rows.map(x => ({
  deduct_id: x.deduct_id,
  user: x.user_id,
  deduct: Number(x.deduct_amt),
  orig_id: x.orig_id,
  orig_code: x.orig_code,
  orig_amt: x.orig_amt ? Number(x.orig_amt) : null,
  deduct_day: new Date(x.deduct_date).toISOString().slice(0,10),
  orig_day: x.orig_date ? new Date(x.orig_date).toISOString().slice(0,10) : null,
})))
await c.end()
