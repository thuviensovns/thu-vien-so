import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

console.log('\n--- Commission rows split by source ---')
const split = await c.query(`
  SELECT
    CASE
      WHEN source_id LIKE 'ADMIN%' THEN 'ADMIN-derived (wrong)'
      WHEN source_id LIKE 'NAPKH%' OR source_id ~ '^[0-9]+$' THEN 'Real bank (correct)'
      ELSE 'Other'
    END AS kind,
    status,
    COUNT(*)::int AS cnt,
    SUM(commission_amount)::bigint AS sum
  FROM affiliate_commissions
  GROUP BY kind, status
  ORDER BY kind, status
`)
console.table(split.rows)

console.log('\n--- ADMIN-derived commissions detail ---')
const admin = await c.query(`
  SELECT id, referrer_user_id, referred_user_id, source_id, base_amount, commission_amount, status, created_at
  FROM affiliate_commissions
  WHERE source_id LIKE 'ADMIN%'
  ORDER BY created_at DESC
`)
console.table(admin.rows.map(x => ({
  id: x.id, referrer: x.referrer_user_id, referred: x.referred_user_id,
  source: x.source_id, base: Number(x.base_amount), commission: Number(x.commission_amount),
  status: x.status,
})))

console.log('\n--- Affected referrers (sum of wrong commissions per user) ---')
const refs = await c.query(`
  SELECT referrer_user_id, COUNT(*)::int AS cnt, SUM(commission_amount)::bigint AS to_reverse
  FROM affiliate_commissions
  WHERE source_id LIKE 'ADMIN%' AND status = 'credited'
  GROUP BY referrer_user_id
  ORDER BY to_reverse DESC
`)
console.table(refs.rows.map(x => ({
  user_id: x.referrer_user_id,
  count: Number(x.cnt),
  to_reverse_VND: Number(x.to_reverse).toLocaleString('vi-VN'),
})))

console.log('\n--- Matching COMM topup audit rows that need deletion ---')
// COMM topup row's bank_description embeds the original source_id (e.g. "topup#ADMINMOEEI2C2")
const commTopups = await c.query(`
  SELECT t.id, t.user_id, t.amount, t.transfer_code, t.bank_description
  FROM topups t
  WHERE t.transfer_code LIKE 'COMM%'
    AND t.bank_description LIKE '%topup#ADMIN%'
  ORDER BY t.created_at DESC
`)
console.table(commTopups.rows.map(x => ({
  id: x.id, user: x.user_id, amount: Number(x.amount),
  code: x.transfer_code, desc: (x.bank_description || '').slice(0, 70),
})))

await c.end()
