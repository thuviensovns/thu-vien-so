/**
 * Reverse affiliate commissions that were wrongly accrued from ADMIN* manual
 * top-ups. Per business rule: admin cộng tay = số ảo, không phải doanh thu →
 * không được phát hoa hồng.
 *
 * For each affiliate_commissions row WHERE source_id LIKE 'ADMIN%' AND status='credited':
 *   1. Subtract commission_amount from referrer's users.balance
 *   2. Subtract from affiliate_accounts.total_earned + auto_credited
 *   3. Delete matching COMM* audit row from topups (bank_description ties to source_id)
 *   4. Mark commission row status='reversed' + note
 *
 * Idempotent: re-runs filter on status='credited', so reversed rows skipped.
 */
import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

console.log('\n--- Affected referrers BEFORE reversal ---')
const before = await c.query(`
  SELECT u.id, u.email, u.balance,
         COALESCE(aa.total_earned, 0)::bigint AS total_earned,
         COALESCE(aa.auto_credited, 0)::bigint AS auto_credited
  FROM users u
  LEFT JOIN affiliate_accounts aa ON aa.user_id = u.id
  WHERE u.id IN (
    SELECT DISTINCT referrer_user_id FROM affiliate_commissions
    WHERE source_id LIKE 'ADMIN%' AND status = 'credited'
  )
`)
console.table(before.rows.map(x => ({
  id: x.id, email: x.email,
  balance: Number(x.balance).toLocaleString('vi-VN'),
  total_earned: Number(x.total_earned).toLocaleString('vi-VN'),
  auto_credited: Number(x.auto_credited).toLocaleString('vi-VN'),
})))

// Fetch all wrong commissions
const { rows: wrongCommissions } = await c.query(`
  SELECT id, referrer_user_id, source_id, commission_amount
  FROM affiliate_commissions
  WHERE source_id LIKE 'ADMIN%' AND status = 'credited'
  ORDER BY id
`)

console.log(`\n--- Reversing ${wrongCommissions.length} wrong commissions ---`)

let reversedCount = 0
let totalReversed = 0
let commTopupsDeleted = 0

for (const row of wrongCommissions) {
  const { id, referrer_user_id, source_id, commission_amount } = row
  const amt = Number(commission_amount)

  await c.query('BEGIN')
  try {
    // 1. Reverse referrer balance (allow negative — admin can investigate)
    await c.query(
      `UPDATE users SET balance = COALESCE(balance, 0) - $1 WHERE id = $2`,
      [amt, referrer_user_id],
    )

    // 2. Reverse affiliate_accounts counters
    await c.query(
      `UPDATE affiliate_accounts
       SET total_earned = COALESCE(total_earned, 0) - $1,
           auto_credited = COALESCE(auto_credited, 0) - $1
       WHERE user_id = $2`,
      [amt, referrer_user_id],
    )

    // 3. Delete matching COMM topup audit row(s) — bank_description embeds source_id
    const del = await c.query(
      `DELETE FROM topups
       WHERE transfer_code LIKE 'COMM%'
         AND user_id = $1
         AND bank_description LIKE '%topup#' || $2 || '%'`,
      [referrer_user_id, source_id],
    )
    commTopupsDeleted += del.rowCount ?? 0

    // 4. Mark commission row reversed
    await c.query(
      `UPDATE affiliate_commissions
       SET status = 'reversed',
           note = COALESCE(note, '') || ' [REVERSED: source admin manual top-up — not real revenue]'
       WHERE id = $1`,
      [id],
    )

    await c.query('COMMIT')
    reversedCount++
    totalReversed += amt
    console.log(`  ✓ Reversed commission #${id} (referrer=${referrer_user_id}, source=${source_id}, -${amt}đ)`)
  } catch (err) {
    await c.query('ROLLBACK')
    console.error(`  ✗ Failed to reverse #${id}:`, err.message)
  }
}

console.log(`\n=== Summary ===`)
console.log(`Reversed commissions: ${reversedCount}`)
console.log(`Total VND clawed back: ${totalReversed.toLocaleString('vi-VN')}đ`)
console.log(`COMM* audit topup rows deleted: ${commTopupsDeleted}`)

console.log('\n--- Affected referrers AFTER reversal ---')
const after = await c.query(`
  SELECT u.id, u.email, u.balance,
         COALESCE(aa.total_earned, 0)::bigint AS total_earned,
         COALESCE(aa.auto_credited, 0)::bigint AS auto_credited
  FROM users u
  LEFT JOIN affiliate_accounts aa ON aa.user_id = u.id
  WHERE u.id IN (
    SELECT DISTINCT referrer_user_id FROM affiliate_commissions
    WHERE source_id LIKE 'ADMIN%'
  )
`)
console.table(after.rows.map(x => ({
  id: x.id, email: x.email,
  balance: Number(x.balance).toLocaleString('vi-VN'),
  total_earned: Number(x.total_earned).toLocaleString('vi-VN'),
  auto_credited: Number(x.auto_credited).toLocaleString('vi-VN'),
})))

await c.end()
