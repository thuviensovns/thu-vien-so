/**
 * Trace what happens to creditedAt + balance between each flip.
 * Goal: find why flip3 still credits despite creditedAt being set on flip1.
 */
const BASE = process.env.BASE || 'https://www.thuvienso.top'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const TEST_USER_ID = 3
const TEST_AMOUNT = 1000

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 300) } }
}

const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const cookie = (login.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''

async function getTopup(id) {
  const r = await fetch(`${BASE}/api/topups/${id}`, { headers: { Cookie: cookie } }).then(j)
  return r.data
}
async function getBalance() {
  const r = await fetch(`${BASE}/api/users/${TEST_USER_ID}`, { headers: { Cookie: cookie } }).then(j)
  return r.data?.balance ?? 0
}
async function patch(id, body) {
  return fetch(`${BASE}/api/topups/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  }).then(j)
}

const b0 = await getBalance()
console.log('=== START ===')
console.log('balance:', b0)

const code = `TRACE${Date.now().toString(36).toUpperCase()}`
const create = await fetch(`${BASE}/api/topups`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ user: TEST_USER_ID, amount: TEST_AMOUNT, transferCode: code, status: 'pending' }),
}).then(j)
const id = create.data?.doc?.id || create.data?.id
console.log('topup:', id)

console.log('\n=== FLIP 1: pending → completed ===')
const f1 = await patch(id, { status: 'completed' })
console.log('PATCH response creditedAt:', f1.data?.doc?.creditedAt)
await new Promise(r => setTimeout(r, 1000))
const t1 = await getTopup(id)
console.log('  DB status:', t1.status, 'creditedAt:', t1.creditedAt, 'confirmedAt:', t1.confirmedAt)
const b1 = await getBalance()
console.log('  balance:', b1, 'delta:', b1 - b0)

console.log('\n=== FLIP 2: completed → pending ===')
const f2 = await patch(id, { status: 'pending' })
console.log('PATCH response creditedAt:', f2.data?.doc?.creditedAt, '(should still be set!)')
await new Promise(r => setTimeout(r, 500))
const t2 = await getTopup(id)
console.log('  DB status:', t2.status, 'creditedAt:', t2.creditedAt, '(should still be set!)')
const b15 = await getBalance()
console.log('  balance:', b15, 'delta from start:', b15 - b0)

console.log('\n=== FLIP 3: pending → completed (should NOT re-credit) ===')
const f3 = await patch(id, { status: 'completed' })
console.log('PATCH response creditedAt:', f3.data?.doc?.creditedAt)
await new Promise(r => setTimeout(r, 1000))
const t3 = await getTopup(id)
console.log('  DB status:', t3.status, 'creditedAt:', t3.creditedAt)
const b2 = await getBalance()
console.log('  balance:', b2, 'delta from start:', b2 - b0)

if (b2 - b0 === TEST_AMOUNT) console.log('\n✅ NO DOUBLE-CREDIT')
else console.log('\n❌ DOUBLE-CREDIT — delta =', b2 - b0, 'expected', TEST_AMOUNT)

await fetch(`${BASE}/api/users/${TEST_USER_ID}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ balance: b0 }),
}).then(j)
await fetch(`${BASE}/api/topups/${id}`, { method: 'DELETE', headers: { Cookie: cookie } }).then(j)
console.log('cleaned up')
