import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

console.log('\n--- Affiliate counters with negative values (data drift) ---')
const before = await c.query(`SELECT user_id, total_earned, auto_credited FROM affiliate_accounts WHERE total_earned < 0 OR auto_credited < 0`)
console.table(before.rows.map(x => ({ user: x.user_id, total_earned: Number(x.total_earned), auto_credited: Number(x.auto_credited) })))

const r1 = await c.query(`UPDATE affiliate_accounts SET total_earned = 0 WHERE total_earned < 0`)
const r2 = await c.query(`UPDATE affiliate_accounts SET auto_credited = 0 WHERE auto_credited < 0`)
console.log(`\nClamped total_earned to 0 on ${r1.rowCount} row(s)`)
console.log(`Clamped auto_credited to 0 on ${r2.rowCount} row(s)`)

console.log('\n--- After clamp ---')
const after = await c.query(`SELECT aa.user_id, u.email, aa.total_earned, aa.auto_credited FROM affiliate_accounts aa JOIN users u ON u.id = aa.user_id WHERE aa.user_id IN (${before.rows.map(x => x.user_id).join(',') || 'NULL'})`)
console.table(after.rows.map(x => ({ user: x.user_id, email: x.email, total_earned: Number(x.total_earned), auto_credited: Number(x.auto_credited) })))

await c.end()
