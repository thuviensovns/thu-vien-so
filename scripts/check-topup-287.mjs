/**
 * Inspect orphan topup #287 to decide if it needs manual cleanup.
 */
import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const r = await client.query(`SELECT * FROM topups WHERE id = 287`)
console.log('Topup #287:', r.rows[0])

// Check user 4 balance + any credited topups from same window
const u = await client.query(`SELECT id, email, balance FROM users WHERE id = 4`)
console.log('\nUser 4:', u.rows[0])

const sibling = await client.query(`
  SELECT id, amount, status, bank_transaction_id, credited_at, created_at
  FROM topups
  WHERE user_id = 4 AND created_at > now() - interval '3 hours'
  ORDER BY created_at DESC
`)
console.log('\nAll recent topups for user 4:')
for (const t of sibling.rows) {
  console.log(`  #${t.id} ${t.amount} ${t.status} bankTx=${t.bank_transaction_id || '-'} credited=${t.credited_at || '-'} created=${t.created_at?.toISOString()}`)
}

await client.end()
