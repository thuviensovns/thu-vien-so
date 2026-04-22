import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const r = await c.query(`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'topups' AND (indexdef ILIKE '%transfer_code%' OR indexname ILIKE '%transfer_code%')
`)
console.log('Indexes on topups.transfer_code:')
console.table(r.rows)
const r2 = await c.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint WHERE conrelid = 'topups'::regclass
    AND pg_get_constraintdef(oid) ILIKE '%transfer_code%'
`)
console.log('\nConstraints on topups referencing transfer_code:')
console.table(r2.rows)
await c.end()
