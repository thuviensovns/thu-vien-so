/**
 * Cleanup test accounts and their cascade data.
 *
 * USAGE:
 *   node scripts/cleanup-test-data.mjs              # dry-run: only lists
 *   node scripts/cleanup-test-data.mjs --execute    # ACTUALLY DELETES (irreversible)
 *
 * Targets users whose email matches test patterns:
 *   - *@example.com
 *   - test-*@*
 *   - e2e-*@*
 *
 * Cascade deletes per matched user (in order):
 *   1. downloads   (where user = id)
 *   2. orders      (where user = id)
 *   3. topups      (where user = id)
 *   4. contact-messages (where email = user.email)
 *   5. user        (the account itself)
 *
 * Never touches: admin account, or any non-test email.
 *
 * DB is shared between dev and prod (Neon) — running against localhost
 * deletes from prod DB. Script requires admin login via HTTP.
 */
const BASE = process.env.BASE || 'http://localhost:3001'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Anhdungpro1@'
const EXECUTE = process.argv.includes('--execute')

const TEST_PATTERNS = [
  /@example\.com$/i,
  /^test-.+@/i,
  /^e2e-.+@/i,
]

function isTestEmail(email) {
  if (!email) return false
  if (email === ADMIN_EMAIL) return false
  return TEST_PATTERNS.some((re) => re.test(email))
}

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, text: text.slice(0, 400) } }
}

console.log('=== Cleanup Test Data ===')
console.log('BASE:', BASE)
console.log('Mode:', EXECUTE ? '*** EXECUTE (irreversible) ***' : 'dry-run')
console.log('Admin:', ADMIN_EMAIL)
console.log('')

// 1. Login as admin
const loginRes = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const cookie = (loginRes.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
if (!cookie) {
  console.error('FAIL: admin login — check ADMIN_EMAIL/ADMIN_PASSWORD')
  process.exit(1)
}
console.log('Admin login: OK')

const H = { 'Content-Type': 'application/json', Cookie: cookie }

// 2. Fetch all users
const users = await fetch(`${BASE}/api/users?limit=1000&depth=0`, { headers: H }).then(j)
if (users.status !== 200) {
  console.error('FAIL: cannot fetch users', users)
  process.exit(1)
}

const allUsers = users.data?.docs || []
const testUsers = allUsers.filter((u) => isTestEmail(u.email))

console.log(`\nTotal users in DB: ${allUsers.length}`)
console.log(`Test accounts matching patterns: ${testUsers.length}`)

if (testUsers.length === 0) {
  console.log('\nNothing to delete. Exiting.')
  process.exit(0)
}

// 3. For each test user, gather cascade counts
const plan = []
for (const u of testUsers) {
  const [orders, downloads, topups, messages] = await Promise.all([
    fetch(`${BASE}/api/orders?where[user][equals]=${u.id}&limit=0&depth=0`, { headers: H }).then(j),
    fetch(`${BASE}/api/downloads?where[user][equals]=${u.id}&limit=0&depth=0`, { headers: H }).then(j),
    fetch(`${BASE}/api/topups?where[user][equals]=${u.id}&limit=0&depth=0`, { headers: H }).then(j),
    fetch(`${BASE}/api/contact-messages?where[email][equals]=${encodeURIComponent(u.email)}&limit=0&depth=0`, { headers: H }).then(j),
  ])
  plan.push({
    user: u,
    ordersCount: orders.data?.totalDocs ?? 0,
    downloadsCount: downloads.data?.totalDocs ?? 0,
    topupsCount: topups.data?.totalDocs ?? 0,
    messagesCount: messages.data?.totalDocs ?? 0,
  })
}

// 4. Print the plan
console.log('\n--- Deletion plan ---')
let totalOrders = 0, totalDownloads = 0, totalTopups = 0, totalMessages = 0
for (const row of plan) {
  console.log(`  user #${row.user.id} ${row.user.email}`)
  console.log(`    orders: ${row.ordersCount}, downloads: ${row.downloadsCount}, topups: ${row.topupsCount}, messages: ${row.messagesCount}`)
  totalOrders += row.ordersCount
  totalDownloads += row.downloadsCount
  totalTopups += row.topupsCount
  totalMessages += row.messagesCount
}
console.log('\n--- Totals ---')
console.log(`  Users:     ${plan.length}`)
console.log(`  Orders:    ${totalOrders}`)
console.log(`  Downloads: ${totalDownloads}`)
console.log(`  Topups:    ${totalTopups}`)
console.log(`  Messages:  ${totalMessages}`)

if (!EXECUTE) {
  console.log('\n[dry-run] No changes made. Re-run with --execute to actually delete.')
  process.exit(0)
}

// 5. EXECUTE: delete cascades in safe order
console.log('\n=== EXECUTING DELETION ===')

async function deleteAllInCollection(collection, where) {
  // Fetch all matching IDs, then delete one by one
  const list = await fetch(`${BASE}/api/${collection}?${where}&limit=500&depth=0`, { headers: H }).then(j)
  const docs = list.data?.docs || []
  let ok = 0, fail = 0
  for (const d of docs) {
    const r = await fetch(`${BASE}/api/${collection}/${d.id}`, { method: 'DELETE', headers: H })
    if (r.ok) ok += 1
    else {
      fail += 1
      const body = await r.text().catch(() => '')
      console.error(`    delete ${collection}/${d.id} FAIL ${r.status} ${body.slice(0, 120)}`)
    }
  }
  return { ok, fail }
}

let failures = 0
for (const row of plan) {
  const u = row.user
  console.log(`\n  cleaning user #${u.id} ${u.email}`)

  // Downloads first (may reference orders)
  const dl = await deleteAllInCollection('downloads', `where[user][equals]=${u.id}`)
  console.log(`    downloads: ${dl.ok} deleted, ${dl.fail} failed`)
  failures += dl.fail

  // Orders
  const ord = await deleteAllInCollection('orders', `where[user][equals]=${u.id}`)
  console.log(`    orders: ${ord.ok} deleted, ${ord.fail} failed`)
  failures += ord.fail

  // Topups
  const tp = await deleteAllInCollection('topups', `where[user][equals]=${u.id}`)
  console.log(`    topups: ${tp.ok} deleted, ${tp.fail} failed`)
  failures += tp.fail

  // Contact messages (matched by email, not user id)
  const msg = await deleteAllInCollection('contact-messages', `where[email][equals]=${encodeURIComponent(u.email)}`)
  console.log(`    messages: ${msg.ok} deleted, ${msg.fail} failed`)
  failures += msg.fail

  // Finally, the user itself
  const userDel = await fetch(`${BASE}/api/users/${u.id}`, { method: 'DELETE', headers: H })
  if (userDel.ok) console.log(`    user: deleted`)
  else {
    const body = await userDel.text().catch(() => '')
    console.error(`    user DELETE FAIL ${userDel.status} ${body.slice(0, 200)}`)
    failures += 1
  }
}

console.log('\n=== DONE ===')
console.log(`Failures: ${failures}`)
if (failures > 0) process.exit(1)
