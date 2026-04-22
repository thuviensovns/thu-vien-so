/**
 * End-to-end verifier for auto-credit pipeline.
 *
 *  - Dumps current bank_config poll state
 *  - Lists last 10 topups with status + credit timestamps
 *  - Shows most recent Web2M last_poll_at / last_status
 *  - Counts pending topups older than 30 minutes (should be ~0 with expire job)
 */
import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

const cfg = await c.query(
  `SELECT web2m_enabled, web2m_last_poll_at, web2m_last_status,
          NOW() - web2m_last_poll_at AS age FROM bank_config LIMIT 1`,
)
console.log('--- bank_config Web2M state ---')
console.table(cfg.rows)

const topups = await c.query(
  `SELECT id, user_id, amount, status, transfer_code,
          bank_transaction_id, credited_at, created_at
     FROM topups ORDER BY id DESC LIMIT 10`,
)
console.log('--- last 10 topups ---')
console.table(topups.rows)

const stale = await c.query(
  `SELECT COUNT(*) AS cnt FROM topups
    WHERE status = 'pending' AND expires_at < NOW()`,
)
console.log('--- stale pending (expired, not yet swept) ---')
console.table(stale.rows)

await c.end()
