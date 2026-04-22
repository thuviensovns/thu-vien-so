/**
 * Add web2m_api_type column if missing + set bank_config row to 'openapi'.
 * Safe to re-run.
 */
import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

await client.query(`ALTER TABLE bank_config ADD COLUMN IF NOT EXISTS web2m_api_type VARCHAR DEFAULT 'openapi'`)
const r = await client.query(`UPDATE bank_config SET web2m_api_type = 'openapi' RETURNING id, web2m_enabled, web2m_bank, web2m_api_type`)
console.log('updated rows:', r.rows)

// Quick probe using current token to show what the URL looks like + response
const cfg = (await client.query(`SELECT web2m_bank, web2m_token FROM bank_config LIMIT 1`)).rows[0]
const token = cfg?.web2m_token
const bank = cfg?.web2m_bank || 'acb'
if (token) {
  const url = `https://api.web2m.com/historyapiopen${bank === 'vietcombank' ? 'vcb' : bank === 'techcombank' ? 'tcb' : bank === 'vietinbank' ? 'vietin' : bank}/${encodeURIComponent(token)}`
  console.log('OpenAPI URL:', url)
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  console.log('HTTP', res.status, '→', (await res.text()).slice(0, 200))
}

await client.end()
