/**
 * One-shot: expire the orphan pending topup #287 (user #4 was already credited
 * via #288). Safe to run multiple times — only touches rows where the flag is
 * pending and no credit has happened.
 */
import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const r = await client.query(
  `UPDATE topups
     SET status = 'expired', updated_at = NOW()
   WHERE id = 287 AND status = 'pending' AND credited_at IS NULL AND bank_transaction_id IS NULL
   RETURNING id, user_id, amount, status`,
)
console.log('Expired rows:', r.rows)

// Also sweep any other orphan pending past their expires_at
const sweep = await client.query(
  `UPDATE topups
     SET status = 'expired', updated_at = NOW()
   WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW()
   RETURNING id, user_id, amount`,
)
console.log('Swept stale pending topups:', sweep.rows)

await client.end()
