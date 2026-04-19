/**
 * Adds preview_audio_* columns to products table.
 *
 * Reason: Products collection gained audio upload fields (audioUrl,
 * audioR2Key, audioFileName, audioFileSize, audioMimeType). Payload
 * config has push:false so we need to add these columns manually,
 * otherwise every product query fails with
 *   "column products.preview_audio_url does not exist"
 */
import { readFileSync } from 'fs'
import pg from 'pg'

const envText = readFileSync('.env.local', 'utf8')
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1]

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

const queries = [
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_audio_url VARCHAR`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_audio_r2_key VARCHAR`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_audio_file_name VARCHAR`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_audio_file_size NUMERIC`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_audio_mime_type VARCHAR`,
]

for (const q of queries) {
  try {
    await client.query(q)
    console.log('OK:', q)
  } catch (e) {
    console.log('ERR:', q, '->', e.message)
  }
}

const { rows } = await client.query(
  `SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'products' AND column_name LIKE 'preview_%'
   ORDER BY ordinal_position`,
)
console.log('\npreview_* columns after migration:')
console.table(rows)

await client.end()
