/**
 * E2E test for the fulfillOrder dedupe-by-(user,product) fix.
 * Purchases the SAME product twice and verifies /api/downloads returns only 1 row.
 */
const BASE = 'http://localhost:3001'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const CUST_EMAIL = `dedupe-${Date.now()}@example.com`
const CUST_PASSWORD = 'Test1234!'

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 600) } }
}

// Register customer
const reg = await fetch(`${BASE}/api/users`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD, displayName: 'Dedupe Test' }),
}).then(j)
console.log('register:', reg.status)

// Admin login + credit
const adminLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const adminCookie = (adminLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
await fetch(`${BASE}/api/admin/topups`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ email: CUST_EMAIL, amount: 500000 }),
}).then(j)

// Customer login
const custLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD }),
})
const custCookie = (custLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('customer login:', custLogin.status)

// Get first product
const p = await fetch(`${BASE}/api/products?limit=3`).then(j)
const product = p.data?.docs?.[0]
console.log('target product:', product?.id, product?.name)

// Buy same product TWICE
for (const round of [1, 2]) {
  const order = await fetch(`${BASE}/api/payment/create-order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: custCookie },
    body: JSON.stringify({ items: [{ productId: String(product.id) }], paymentMethod: 'balance' }),
  }).then(j)
  const pay = await fetch(`${BASE}/api/payment/pay-with-balance`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: custCookie },
    body: JSON.stringify({ orderId: order.data.orderId }),
  }).then(j)
  console.log(`  round ${round}: order=${order.data?.orderId} pay.success=${pay.data?.success}`)
}

// Verify: only ONE download row for this product
const post = await fetch(`${BASE}/api/downloads?depth=1&sort=-createdAt&limit=20`, { headers: { Cookie: custCookie } }).then(j)
console.log('\nTotal downloads rows after 2 purchases:', post.data?.docs?.length)
const forProduct = post.data?.docs?.filter((d) => {
  const pid = typeof d.product === 'object' ? d.product.id : d.product
  return String(pid) === String(product.id)
})
console.log(`Rows for product ${product.id}:`, forProduct?.length)
console.log('PASS:', forProduct?.length === 1 ? 'YES — dedupe works' : 'NO — duplicates still present')
