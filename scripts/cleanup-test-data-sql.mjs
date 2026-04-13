/**
 * Cleanup remaining test accounts via raw SQL.
 * The HTTP/Payload approach failed with "payload_locked_documents_rels" issues.
 *
 * USAGE:
 *   node scripts/cleanup-test-data-sql.mjs              # dry-run
 *   node scripts/cleanup-test-data-sql.mjs --execute    # ACTUALLY DELETES
 *
 * Deletes users matching @example.com and all their cascade data.
 * Never touches admin.
 */
import pg from 'pg'
import fs from 'fs'

const EXECUTE = process.argv.includes('--execute')
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'

// Read DATABASE_URL from .env.local
const envText = fs.readFileSync('.env.local', 'utf8')
const dbUrlMatch = envText.match(/^DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?/m)
if (!dbUrlMatch) {
  console.error('FAIL: DATABASE_URL not found in .env.local')
  process.exit(1)
}
const DATABASE_URL = dbUrlMatch[1]

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
})

async function q(sql, params = []) {
  const res = await pool.query(sql, params)
  return res
}

console.log('=== Cleanup Test Data (Raw SQL) ===')
console.log('Mode:', EXECUTE ? '*** EXECUTE (irreversible) ***' : 'dry-run')

// 1. Find test users
const { rows: testUsers } = await q(
  `SELECT id, email FROM users
   WHERE email LIKE '%@example.com'
     AND email <> $1
   ORDER BY id`,
  [ADMIN_EMAIL],
)
console.log(`\nTest users found: ${testUsers.length}`)
for (const u of testUsers) console.log(`  #${u.id} ${u.email}`)

if (testUsers.length === 0) {
  console.log('Nothing to clean. Exiting.')
  await pool.end()
  process.exit(0)
}

const userIds = testUsers.map((u) => u.id)
const userEmails = testUsers.map((u) => u.email)

// 2. Survey: list all tables that reference users via FK
const { rows: fkRefs } = await q(`
  SELECT
    tc.table_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users'
  ORDER BY tc.table_name
`)
console.log('\nTables with FK to users:')
for (const r of fkRefs) console.log(`  ${r.table_name}.${r.column_name}`)

// 3. Count cascade data
console.log('\n--- Cascade counts ---')
const counts = {}
for (const table of ['orders', 'downloads', 'topups']) {
  const { rows } = await q(
    `SELECT COUNT(*)::int AS n FROM ${table} WHERE user_id = ANY($1::int[])`,
    [userIds],
  )
  counts[table] = rows[0].n
  console.log(`  ${table}: ${rows[0].n}`)
}

const { rows: msgCount } = await q(
  `SELECT COUNT(*)::int AS n FROM contact_messages WHERE email = ANY($1::text[])`,
  [userEmails],
)
counts.messages = msgCount[0].n
console.log(`  contact_messages (by email): ${msgCount[0].n}`)

// payload_locked_documents_rels — stale locks that block Payload deletes
const { rows: lockRels } = await q(
  `SELECT COUNT(*)::int AS n FROM payload_locked_documents_rels WHERE users_id = ANY($1::int[])`,
  [userIds],
).catch(() => ({ rows: [{ n: 0 }] }))
console.log(`  payload_locked_documents_rels: ${lockRels[0].n}`)

if (!EXECUTE) {
  console.log('\n[dry-run] No changes. Re-run with --execute.')
  await pool.end()
  process.exit(0)
}

// 4. EXECUTE in a transaction — all or nothing
console.log('\n=== EXECUTING in transaction ===')
const client = await pool.connect()
try {
  await client.query('BEGIN')

  // Clean payload_locked_documents_rels first (references all collections)
  // Delete any lock rel row where users_id OR orders_id/downloads_id/topups_id point at our data
  const { rows: orderIdsRows } = await client.query(
    `SELECT id FROM orders WHERE user_id = ANY($1::int[])`,
    [userIds],
  )
  const orderIds = orderIdsRows.map((r) => r.id)

  const { rows: dlIdsRows } = await client.query(
    `SELECT id FROM downloads WHERE user_id = ANY($1::int[])`,
    [userIds],
  )
  const dlIds = dlIdsRows.map((r) => r.id)

  const { rows: topupIdsRows } = await client.query(
    `SELECT id FROM topups WHERE user_id = ANY($1::int[])`,
    [userIds],
  )
  const topupIds = topupIdsRows.map((r) => r.id)

  const { rows: msgIdsRows } = await client.query(
    `SELECT id FROM contact_messages WHERE email = ANY($1::text[])`,
    [userEmails],
  )
  const msgIds = msgIdsRows.map((r) => r.id)

  // Discover actual column names in payload_locked_documents_rels
  const { rows: lockCols } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'payload_locked_documents_rels'`,
  )
  const lockColNames = new Set(lockCols.map((c) => c.column_name))
  const lockClauses = []
  const lockParams = []
  let p = 1
  if (lockColNames.has('users_id')) {
    lockClauses.push(`users_id = ANY($${p}::int[])`); lockParams.push(userIds); p += 1
  }
  if (lockColNames.has('orders_id') && orderIds.length) {
    lockClauses.push(`orders_id = ANY($${p}::int[])`); lockParams.push(orderIds); p += 1
  }
  if (lockColNames.has('downloads_id') && dlIds.length) {
    lockClauses.push(`downloads_id = ANY($${p}::int[])`); lockParams.push(dlIds); p += 1
  }
  if (lockColNames.has('topups_id') && topupIds.length) {
    lockClauses.push(`topups_id = ANY($${p}::int[])`); lockParams.push(topupIds); p += 1
  }

  let locksDeleted = 0
  if (lockClauses.length) {
    const { rowCount } = await client.query(
      `DELETE FROM payload_locked_documents_rels WHERE ${lockClauses.join(' OR ')}`,
      lockParams,
    )
    locksDeleted = rowCount
  }
  console.log(`  payload_locked_documents_rels: ${locksDeleted} deleted`)

  // Delete items arrays (orders have array of items — separate table orders_items)
  const { rowCount: itemsDeleted } = await client.query(
    `DELETE FROM orders_items WHERE _parent_id = ANY($1::int[])`,
    [orderIds],
  ).catch((e) => {
    console.log('  orders_items skip:', e.message)
    return { rowCount: 0 }
  })
  console.log(`  orders_items: ${itemsDeleted} deleted`)

  // Now delete the cascade
  const { rowCount: dlDeleted } = await client.query(
    `DELETE FROM downloads WHERE user_id = ANY($1::int[])`,
    [userIds],
  )
  console.log(`  downloads: ${dlDeleted} deleted`)

  const { rowCount: ordDeleted } = await client.query(
    `DELETE FROM orders WHERE user_id = ANY($1::int[])`,
    [userIds],
  )
  console.log(`  orders: ${ordDeleted} deleted`)

  const { rowCount: tpDeleted } = await client.query(
    `DELETE FROM topups WHERE user_id = ANY($1::int[])`,
    [userIds],
  )
  console.log(`  topups: ${tpDeleted} deleted`)

  const { rowCount: msgDeleted } = await client.query(
    `DELETE FROM contact_messages WHERE email = ANY($1::text[])`,
    [userEmails],
  )
  console.log(`  contact_messages: ${msgDeleted} deleted`)

  // Auth sessions
  const { rowCount: sessionsDeleted } = await client.query(
    `DELETE FROM users_sessions WHERE _parent_id = ANY($1::int[])`,
    [userIds],
  ).catch((e) => {
    console.log('  users_sessions skip:', e.message)
    return { rowCount: 0 }
  })
  console.log(`  users_sessions: ${sessionsDeleted} deleted`)

  // Admin UI preferences (parent table via users_id join)
  const { rowCount: prefsDeleted } = await client.query(
    `DELETE FROM payload_preferences
     WHERE id IN (
       SELECT parent_id FROM payload_preferences_rels WHERE users_id = ANY($1::int[])
     )`,
    [userIds],
  ).catch((e) => {
    console.log('  payload_preferences skip:', e.message)
    return { rowCount: 0 }
  })
  console.log(`  payload_preferences: ${prefsDeleted} deleted`)

  // Finally, delete users
  const { rowCount: usersDeleted } = await client.query(
    `DELETE FROM users WHERE id = ANY($1::int[])`,
    [userIds],
  )
  console.log(`  users: ${usersDeleted} deleted`)

  await client.query('COMMIT')
  console.log('\n=== COMMITTED ===')
} catch (e) {
  await client.query('ROLLBACK')
  console.error('\n=== ROLLED BACK ===')
  console.error(e.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
