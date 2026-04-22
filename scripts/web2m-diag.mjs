/**
 * Diagnose Web2M state: read current config, call the API, show raw response.
 */
import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const r = await client.query(`SELECT * FROM bank_config LIMIT 1`)
const cfg = r.rows[0] || {}

const redact = (s) => (s ? `${String(s).slice(0, 4)}...${String(s).slice(-4)} (len=${String(s).length})` : '(empty)')

console.log('=== bank_config ===')
console.log('web2m_enabled       :', cfg.web2m_enabled)
console.log('web2m_bank          :', cfg.web2m_bank)
console.log('web2m_api_version   :', cfg.web2m_api_version)
console.log('web2m_account_number:', cfg.web2m_account_number)
console.log('web2m_password      :', redact(cfg.web2m_password))
console.log('web2m_token         :', redact(cfg.web2m_token))
console.log('web2m_api_url       :', cfg.web2m_api_url || '(using default template)')
console.log('web2m_last_poll_at  :', cfg.web2m_last_poll_at)
console.log('web2m_last_status   :', cfg.web2m_last_status)

const BANK_URL_TEMPLATES = {
  acb: 'https://api.web2m.com/historyapiacb/{password}/{account}/{token}',
  bidv: 'https://api.web2m.com/historyapibidv/{password}/{account}/{token}',
  mbbank: 'https://api.web2m.com/historyapimbbank/{password}/{account}/{token}',
  tpbank: 'https://api.web2m.com/historyapitpbank/{password}/{account}/{token}',
  vietcombank: 'https://api.web2m.com/historyapivcb/{password}/{account}/{token}',
  techcombank: 'https://api.web2m.com/historyapitcb/{password}/{account}/{token}',
  vietinbank: 'https://api.web2m.com/historyapivietin/{password}/{account}/{token}',
}

const bank = (cfg.web2m_bank || 'acb').trim()
const template = (cfg.web2m_api_url || BANK_URL_TEMPLATES[bank] || BANK_URL_TEMPLATES.acb)
const url = template
  .replace(/\{account\}/g, encodeURIComponent(cfg.web2m_account_number || ''))
  .replace(/\{password\}/g, encodeURIComponent(cfg.web2m_password || ''))
  .replace(/\{token\}/g, encodeURIComponent(cfg.web2m_token || ''))

console.log('\n=== URL (masked) ===')
console.log(url.replace(cfg.web2m_password || '__', '***PWD***').replace(cfg.web2m_token || '__', '***TOKEN***'))

console.log('\n=== GET Web2M ===')
try {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  console.log('HTTP:', res.status)
  const text = await res.text()
  console.log('Body (first 500 chars):', text.slice(0, 500))
} catch (err) {
  console.log('Fetch error:', err.message)
}

await client.end()
