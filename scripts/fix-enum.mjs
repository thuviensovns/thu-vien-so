import { readFileSync } from 'fs'
import pg from 'pg'

const envText = readFileSync('.env.local', 'utf8')
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1]
const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

const { rows } = await client.query(
  `SELECT e.enumlabel FROM pg_enum e
   JOIN pg_type t ON e.enumtypid = t.oid
   WHERE t.typname = 'enum_orders_payment_method'
   ORDER BY e.enumsortorder`,
)
console.log('Current enum values:', rows.map((r) => r.enumlabel))

const needed = ['vnpay', 'momo', 'zalopay', 'bank-transfer', 'balance']
for (const v of needed) {
  try {
    await client.query(`ALTER TYPE enum_orders_payment_method ADD VALUE IF NOT EXISTS '${v}'`)
    console.log('ensured:', v)
  } catch (e) {
    console.log('err:', v, e.message)
  }
}

const { rows: after } = await client.query(
  `SELECT e.enumlabel FROM pg_enum e
   JOIN pg_type t ON e.enumtypid = t.oid
   WHERE t.typname = 'enum_orders_payment_method'
   ORDER BY e.enumsortorder`,
)
console.log('After:', after.map((r) => r.enumlabel))

await client.end()
