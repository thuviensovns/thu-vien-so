/**
 * Verify: the /api/download/[token] route rewrites Google Drive share links
 * to force-download form so the browser actually saves the file.
 *
 * Before fix: response url = drive.google.com/file/d/{ID}/view — Chrome
 * ignores <a download> and opens preview. User sees "Xong" on payment
 * success page but nothing saved to disk — the "treo" complaint.
 */
const BASE = process.env.BASE || 'http://localhost:3001'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const CUST_EMAIL = `test-pay-dl-${Date.now()}@example.com`
const CUST_PASSWORD = 'Test1234!'

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, text: text.slice(0, 300) } }
}

console.log('=== Payment download URL rewrite test ===')

// 1. Register customer
await fetch(`${BASE}/api/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD, displayName: 'Pay DL Test' }),
}).then(j)

// 2. Admin login + topup
const adminLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const adminCookie = (adminLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''

await fetch(`${BASE}/api/admin/topups`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ email: CUST_EMAIL, amount: 200000 }),
}).then(j)
console.log('1. setup OK')

// 3. Customer login + buy
const custLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD }),
})
const custCookie = (custLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''

// Find a product with file.downloadUrl = Google Drive
const prods = await fetch(`${BASE}/api/products?limit=5&depth=0`).then(j)
const targetProduct = prods.data?.docs?.find((p) => p.file?.downloadUrl?.includes('drive.google.com/file/d/'))
if (!targetProduct) { console.error('FAIL: no Drive product found'); process.exit(1) }
console.log(`2. using product: ${targetProduct.name} (id=${targetProduct.id})`)
console.log(`   raw url: ${targetProduct.file.downloadUrl.slice(0, 70)}...`)

const order = await fetch(`${BASE}/api/payment/create-order`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ items: [{ productId: String(targetProduct.id) }], paymentMethod: 'balance' }),
}).then(j)

const pay = await fetch(`${BASE}/api/payment/pay-with-balance`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ orderId: order.data.orderId }),
}).then(j)
console.log('3. paid:', pay.status, 'token:', pay.data?.downloadToken?.slice(0, 12) + '...')

const token = pay.data?.downloadToken
if (!token) { console.error('FAIL: no download token'); process.exit(1) }

// 4. Hit /api/download/[token]?productId=X — this is the payment success page's endpoint
const dl = await fetch(`${BASE}/api/download/${token}?productId=${targetProduct.id}`).then(j)
console.log('4. /api/download/[token]:', dl.status)
console.log('   returned url:', (dl.data?.url || '').slice(0, 90))
console.log('   source:', dl.data?.source)

// Assertions
const url = dl.data?.url || ''
const checks = [
  ['status 200', dl.status === 200],
  ['url uses uc?export=download', url.includes('uc?export=download') && url.includes('&id=')],
  ['url has confirm=t (virus-scan bypass)', url.includes('confirm=t')],
  ['url contains a file id', (url.match(/[?&]id=([^&]+)/)?.[1]?.length || 0) > 10],
  ['url does NOT contain /file/d/', !url.includes('/file/d/')],
]

// 5. Verify the normalized URL reaches Drive (200). Content-type may be HTML
// for files large enough to hit Drive's confirm-page dance — that's fine
// because the manual download button in the UI still works in that case.
let head = null
if (url.startsWith('https://drive.google.com/uc')) {
  const r = await fetch(url, { method: 'GET', redirect: 'follow' })
  head = { status: r.status, ctype: r.headers.get('content-type'), clen: r.headers.get('content-length') }
  console.log('5. drive response:', head)
  checks.push(['drive returns 200', head.status === 200])
}

let failed = 0
for (const [label, ok] of checks) {
  console.log(`   ${ok ? 'PASS' : 'FAIL'}: ${label}`)
  if (!ok) failed += 1
}

if (failed > 0) { console.error(`\n=== ${failed} checks failed ===`); process.exit(1) }
console.log('\n=== PASS: payment download URL rewrite works ===')
