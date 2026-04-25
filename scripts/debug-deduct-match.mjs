import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

console.log('\n--- User 92 topup history ---')
const u92 = await c.query(`SELECT id, amount, transfer_code, status, created_at FROM topups WHERE user_id=92 ORDER BY created_at`)
console.table(u92.rows.map(x => ({ id: x.id, amount: Number(x.amount), code: x.transfer_code, status: x.status, date: new Date(x.created_at).toISOString() })))

console.log('\n--- User 3 topup history (positive amounts) ---')
const u3 = await c.query(`SELECT id, amount, transfer_code, status, created_at FROM topups WHERE user_id=3 AND amount > 0 ORDER BY created_at`)
console.table(u3.rows.map(x => ({ id: x.id, amount: Number(x.amount), code: x.transfer_code, status: x.status, date: new Date(x.created_at).toISOString() })))

console.log('\n--- User 3 DEDUCT timestamp ---')
const d3 = await c.query(`SELECT id, amount, transfer_code, created_at FROM topups WHERE user_id=3 AND transfer_code LIKE 'DEDUCT%'`)
console.table(d3.rows.map(x => ({ id: x.id, amount: Number(x.amount), code: x.transfer_code, date: new Date(x.created_at).toISOString() })))

await c.end()
