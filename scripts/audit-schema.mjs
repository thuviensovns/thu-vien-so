/**
 * Audit what columns Payload wants vs what DB has for orders + users.
 */
import { readFileSync } from 'fs'
import pg from 'pg'

const envText = readFileSync('.env.local', 'utf8')
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1]

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

async function showTable(name) {
  const { rows } = await client.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
    [name],
  )
  console.log(`\n=== ${name} (${rows.length} columns) ===`)
  console.table(rows)
}

for (const t of ['orders', 'users', 'products', 'topups', 'activity_logs', 'coupons']) {
  try {
    await showTable(t)
  } catch (e) {
    console.log(`${t}: ERROR ${e.message}`)
  }
}

// Also check if activity_logs table exists with row count
try {
  const { rows } = await client.query(`SELECT COUNT(*) AS n FROM activity_logs`)
  console.log('\nactivity_logs rows:', rows[0].n)
} catch {}

await client.end()
