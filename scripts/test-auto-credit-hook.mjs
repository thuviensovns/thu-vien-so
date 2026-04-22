/**
 * E2E test: verify afterChange hook on TopUps auto-credits user balance.
 * Creates a pending topup, flips to completed, checks balance delta, cleans up.
 */
const BASE = process.env.BASE || 'https://www.thuvienso.top'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const TEST_USER_ID = 3  // mobagame8910@gmail.com
const TEST_AMOUNT = 1234  // small enough to be obvious

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 300) } }
}

const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const cookie = (login.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log(`[login] ${login.status}`)

const u0 = await fetch(`${BASE}/api/users/${TEST_USER_ID}`, { headers: { Cookie: cookie } }).then(j)
const balanceBefore = u0.data?.balance ?? 0
console.log(`[user ${TEST_USER_ID}] balance BEFORE: ${balanceBefore}`)

const code = `TEST${Date.now().toString(36).toUpperCase()}`
const created = await fetch(`${BASE}/api/topups`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({
    user: TEST_USER_ID,
    amount: TEST_AMOUNT,
    transferCode: code,
    status: 'pending',
  }),
}).then(j)
const topupId = created.data?.doc?.id || created.data?.id
console.log(`[created topup #${topupId}] status=${created.data?.doc?.status} code=${code}`)
if (!topupId) { console.error('Create failed:', created); process.exit(1) }

console.log('→ Flipping status pending → completed via PATCH (triggers hook)...')
const flipped = await fetch(`${BASE}/api/topups/${topupId}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ status: 'completed' }),
}).then(j)
console.log(`[flipped] ${flipped.status} status=${flipped.data?.doc?.status} creditedAt=${flipped.data?.doc?.creditedAt}`)

// give hook + revalidation a moment (hook is synchronous but safety)
await new Promise(r => setTimeout(r, 500))

const u1 = await fetch(`${BASE}/api/users/${TEST_USER_ID}`, { headers: { Cookie: cookie } }).then(j)
const balanceAfter = u1.data?.balance ?? 0
const delta = balanceAfter - balanceBefore
console.log(`[user ${TEST_USER_ID}] balance AFTER:  ${balanceAfter}`)
console.log(`DELTA: ${delta} VND (expected +${TEST_AMOUNT})`)

if (delta === TEST_AMOUNT) {
  console.log('✅ HOOK WORKS — balance credited correctly by afterChange hook.')
} else {
  console.log('❌ HOOK FAILED — balance did not update as expected.')
  process.exit(1)
}

// Cleanup: reverse the balance + mark topup as failed (admin-only cleanup)
console.log('')
console.log('→ Cleaning up test data...')
await fetch(`${BASE}/api/users/${TEST_USER_ID}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ balance: balanceBefore }),
}).then(j)
await fetch(`${BASE}/api/topups/${topupId}`, {
  method: 'DELETE', headers: { Cookie: cookie },
}).then(j)
const u2 = await fetch(`${BASE}/api/users/${TEST_USER_ID}`, { headers: { Cookie: cookie } }).then(j)
console.log(`[cleanup] balance reset to: ${u2.data?.balance} (was ${balanceBefore})`)
console.log('✓ Test complete.')
