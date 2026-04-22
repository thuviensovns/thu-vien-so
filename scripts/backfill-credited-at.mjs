/**
 * Back-fill topups.creditedAt for already-completed rows (one-time).
 * Prevents auto-credit hook from double-crediting if admin toggles status.
 */
import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const before = await client.query(`SELECT COUNT(*) FROM topups WHERE status='completed' AND credited_at IS NULL`)
console.log(`Before: ${before.rows[0].count} completed topups with NULL credited_at`)

const res = await client.query(`
  UPDATE topups
  SET credited_at = COALESCE(confirmed_at, updated_at, created_at, NOW())
  WHERE status = 'completed' AND credited_at IS NULL
  RETURNING id
`)
console.log(`Back-filled ${res.rows.length} rows:`, res.rows.map(r => r.id).join(', '))

const after = await client.query(`SELECT COUNT(*) FROM topups WHERE status='completed' AND credited_at IS NULL`)
console.log(`After: ${after.rows[0].count} completed topups with NULL credited_at`)

await client.end()
console.log('✓ Done')
