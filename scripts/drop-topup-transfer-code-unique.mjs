import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

// Drop unique constraint, re-create as plain btree for lookup perf.
// Wrapped in a tx so we never end up without an index at all.
await c.query('BEGIN')
try {
  await c.query('DROP INDEX IF EXISTS topups_transfer_code_idx')
  await c.query('CREATE INDEX topups_transfer_code_idx ON topups USING btree (transfer_code)')
  await c.query('COMMIT')
  console.log('OK — dropped unique, recreated as non-unique')
} catch (e) {
  await c.query('ROLLBACK')
  console.error('FAILED:', e.message)
  process.exit(1)
}

// Verify
const r = await c.query(`
  SELECT indexname, indexdef FROM pg_indexes
  WHERE tablename = 'topups' AND indexname ILIKE '%transfer_code%'
`)
console.log('\nFinal state:')
console.table(r.rows)
await c.end()
