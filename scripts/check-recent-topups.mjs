/**
 * Show recent topups + last poll status to diagnose "customer deposited but not credited".
 */
import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

console.log('=== Recent topups (last 2 hours) ===')
const r1 = await client.query(`
  SELECT *
  FROM topups
  WHERE created_at > now() - interval '2 hours'
  ORDER BY created_at DESC
  LIMIT 30
`)
for (const t of r1.rows) {
  console.log(
    `#${t.id} user=${t.user_id} amount=${t.amount} status=${t.status} bankTxId=${t.bank_transaction_id || '-'} creditedAt=${t.credited_at || '-'} createdAt=${t.created_at?.toISOString()} note="${(t.note || '').slice(0, 60)}"`
  )
}

console.log('\n=== bank_config poll state ===')
const r2 = await client.query(`SELECT web2m_enabled, web2m_api_type, web2m_bank, web2m_last_poll_at, web2m_last_status FROM bank_config LIMIT 1`)
console.log(r2.rows[0])

console.log('\n=== Raw bank_transactions (last 2 hours) ===')
try {
  const r3 = await client.query(`
    SELECT id, bank_transaction_id, amount, content, credited_at, created_at
    FROM bank_transactions
    WHERE created_at > now() - interval '2 hours'
    ORDER BY created_at DESC
    LIMIT 20
  `)
  for (const t of r3.rows) {
    console.log(
      `bankTxId=${t.bank_transaction_id} amount=${t.amount} creditedAt=${t.credited_at || '-'} created=${t.created_at?.toISOString()} content="${(t.content || '').slice(0, 80)}"`
    )
  }
} catch (e) {
  console.log('(bank_transactions query failed — table may not exist:', e.message, ')')
}

await client.end()
