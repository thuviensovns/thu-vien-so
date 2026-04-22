/**
 * E2E test: ensure re-flipping pending→completed twice does NOT double-credit.
 */
const BASE = process.env.BASE || 'https://www.thuvienso.top'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const TEST_USER_ID = 3
const TEST_AMOUNT = 1000  // collection min is 1000

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 300) } }
}

const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const cookie = (login.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''

const b0 = (await fetch(`${BASE}/api/users/${TEST_USER_ID}`, { headers: { Cookie: cookie } }).then(j)).data?.balance ?? 0
console.log('balance start:', b0)

const code = `TEST${Date.now().toString(36).toUpperCase()}`
const createRes = await fetch(`${BASE}/api/topups`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ user: TEST_USER_ID, amount: TEST_AMOUNT, transferCode: code, status: 'pending' }),
}).then(j)
const topup = createRes.data?.doc || createRes.data
if (!topup?.id) { console.error('Create failed:', createRes); process.exit(1) }
console.log('created topup:', topup.id, 'pending')

// Flip 1: pending → completed (should credit)
await fetch(`${BASE}/api/topups/${topup.id}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ status: 'completed' }),
}).then(j)
await new Promise(r => setTimeout(r, 800))
const b1 = (await fetch(`${BASE}/api/users/${TEST_USER_ID}`, { headers: { Cookie: cookie } }).then(j)).data?.balance ?? 0
console.log('after flip1 (expect +500):', b1, '→ delta:', b1 - b0)

// Flip 2: completed → pending → completed (should NOT re-credit)
await fetch(`${BASE}/api/topups/${topup.id}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ status: 'pending' }),
}).then(j)
await new Promise(r => setTimeout(r, 400))
await fetch(`${BASE}/api/topups/${topup.id}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ status: 'completed' }),
}).then(j)
await new Promise(r => setTimeout(r, 800))
const b2 = (await fetch(`${BASE}/api/users/${TEST_USER_ID}`, { headers: { Cookie: cookie } }).then(j)).data?.balance ?? 0
console.log('after flip2+3 (expect still +500, NOT +1000):', b2, '→ delta from start:', b2 - b0)

if (b2 - b0 === TEST_AMOUNT) {
  console.log('✅ IDEMPOTENCY HOLDS — credit happens exactly once')
} else {
  console.log('❌ DOUBLE-CREDIT DETECTED — delta =', b2 - b0, 'expected', TEST_AMOUNT)
}

// Cleanup
await fetch(`${BASE}/api/users/${TEST_USER_ID}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ balance: b0 }),
}).then(j)
await fetch(`${BASE}/api/topups/${topup.id}`, { method: 'DELETE', headers: { Cookie: cookie } }).then(j)
const b3 = (await fetch(`${BASE}/api/users/${TEST_USER_ID}`, { headers: { Cookie: cookie } }).then(j)).data?.balance ?? 0
console.log('cleanup done. balance:', b3)
