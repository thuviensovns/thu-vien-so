import { readFileSync } from 'fs'
import pg from 'pg'
const envText = readFileSync('.env.local', 'utf8')
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1]
const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

const { rows: tables } = await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
)
console.log('All public tables:')
console.table(tables)

// also check orders_items if exists
for (const t of ['orders_items', 'orders_rels', 'products_images', 'products_tags']) {
  try {
    const { rows } = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [t],
    )
    if (rows.length > 0) {
      console.log(`\n${t}:`)
      console.table(rows)
    }
  } catch {}
}

await client.end()
