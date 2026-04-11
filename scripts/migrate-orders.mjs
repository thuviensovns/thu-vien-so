/**
 * Directly ALTER orders table to add missing download_token columns.
 * Run locally before relying on the API endpoint.
 */
import { readFileSync } from 'fs'
import pg from 'pg'

const envText = readFileSync('.env.local', 'utf8')
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1]
const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

const queries = [
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS download_token VARCHAR`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMPTZ`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_download_token_idx ON orders(download_token)`,
]

for (const q of queries) {
  try {
    await client.query(q)
    console.log('OK:', q.slice(0, 80))
  } catch (e) {
    console.log('ERR:', q.slice(0, 80), '->', e.message)
  }
}

const { rows } = await client.query(
  `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position`,
)
console.log('\norders columns after migration:')
console.table(rows)

await client.end()
