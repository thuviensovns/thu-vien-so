/**
 * Verify fix for /api/download POST: numeric downloadId must work.
 *
 * Before fix: request body { downloadId: 19 } (number) was rejected with 400
 * because the route only accepted string downloadId. Frontend always sends
 * number because DB IDs are numeric.
 */
const BASE = process.env.BASE || 'http://localhost:3001'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, text: text.slice(0, 300) } }
}

console.log('=== Download POST fix verification ===')

// 1. Login as admin
const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const cookie = (login.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
if (!cookie) { console.error('FAIL: admin login'); process.exit(1) }
console.log('1. admin login: OK')

// 2. Find an existing download record
const list = await fetch(`${BASE}/api/downloads?limit=5&depth=1`, {
  headers: { Cookie: cookie },
}).then(j)
const docs = list.data?.docs || []
console.log(`2. found ${docs.length} download records`)
if (docs.length === 0) { console.log('SKIP: no downloads to test'); process.exit(0) }

const dl = docs[0]
const dlId = dl.id
console.log(`   using downloadId=${dlId} (type=${typeof dlId})`)
console.log(`   product name: ${dl.product?.name || 'unknown'}`)

// 3. Test: POST with numeric id (this was broken before fix)
const r1 = await fetch(`${BASE}/api/download`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ downloadId: dlId }),
}).then(j)
console.log(`3. POST /api/download (numeric id): ${r1.status}`)
if (r1.status === 200) {
  console.log('   PASS — got url:', (r1.data?.url || '').slice(0, 60) + '...')
} else {
  console.log('   response:', JSON.stringify(r1.data || r1.text).slice(0, 200))
}

// 4. Test: POST with string id (should still work)
const r2 = await fetch(`${BASE}/api/download`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ downloadId: String(dlId) }),
}).then(j)
console.log(`4. POST /api/download (string id): ${r2.status}`)
if (r2.status === 200) {
  console.log('   PASS — got url:', (r2.data?.url || '').slice(0, 60) + '...')
} else {
  console.log('   response:', JSON.stringify(r2.data || r2.text).slice(0, 200))
}

// 5. Test: POST with invalid id (bad chars) — should return 400
const r3 = await fetch(`${BASE}/api/download`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ downloadId: "<script>" }),
}).then(j)
console.log(`5. POST /api/download (bad chars): ${r3.status} (expected 400)`)

const pass = r1.status === 200 && r2.status === 200 && r3.status === 400
if (pass) { console.log('\n=== ALL PASS ===') }
else { console.error('\n=== FAIL ==='); process.exit(1) }
