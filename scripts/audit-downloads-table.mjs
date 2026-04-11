import { readFileSync } from 'fs'
import pg from 'pg'
const envText = readFileSync('.env.local', 'utf8')
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1]
const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

const tables = ['downloads', 'downloads_download_log', 'downloads_rels']
for (const t of tables) {
  const { rows } = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t])
  if (rows.length) {
    console.log(`\n=== ${t} ===`)
    console.table(rows)
  } else {
    console.log(`\n${t}: NOT FOUND`)
  }
}

const { rows: cnt } = await client.query(`SELECT COUNT(*)::int AS n FROM downloads`).catch(() => ({ rows: [{ n: null }] }))
console.log('downloads row count:', cnt[0].n)

await client.end()
