import { readFileSync } from 'fs'
import pg from 'pg'

const envText = readFileSync('.env.local', 'utf8')
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1]
const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

const { rows } = await client.query(
  `SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname LIKE 'enum_orders%' ORDER BY t.typname, e.enumsortorder`,
)
console.table(rows)

// Add processing if missing
try {
  await client.query(`ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'processing'`)
  console.log('ensured processing')
} catch (e) {
  console.log('err:', e.message)
}

const { rows: after } = await client.query(
  `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname = 'enum_orders_status' ORDER BY e.enumsortorder`,
)
console.log('enum_orders_status after:', after.map((r) => r.enumlabel))

await client.end()
