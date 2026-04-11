/**
 * E2E: register customer -> admin credit -> buy -> verify /api/downloads returns the purchase.
 */
const BASE = 'http://localhost:3000'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const CUST_EMAIL = `test-dl-${Date.now()}@example.com`
const CUST_PASSWORD = 'Test1234!'

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 600) } }
}

// Register
const reg = await fetch(`${BASE}/api/users`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD, displayName: 'DL Test' }),
}).then(j)
console.log('register:', reg.status)

// Admin credit
const adminLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const adminCookie = (adminLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
await fetch(`${BASE}/api/admin/topups`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ email: CUST_EMAIL, amount: 200000 }),
}).then(j)

// Customer login
const custLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD }),
})
const custCookie = (custLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('customer login:', custLogin.status)

// Pre-purchase downloads list (should be 0)
const pre = await fetch(`${BASE}/api/downloads?depth=1&sort=-createdAt&limit=20`, { headers: { Cookie: custCookie } }).then(j)
console.log('pre-purchase downloads.length:', pre.data?.docs?.length)

// Buy
const p = await fetch(`${BASE}/api/products?limit=3`).then(j)
const product = p.data?.docs?.[0]
console.log('buying product:', product?.id, product?.name)

const order = await fetch(`${BASE}/api/payment/create-order`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ items: [{ productId: String(product.id) }], paymentMethod: 'balance' }),
}).then(j)
console.log('create-order:', order.status, order.data?.orderId)

const pay = await fetch(`${BASE}/api/payment/pay-with-balance`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ orderId: order.data.orderId }),
}).then(j)
console.log('pay:', pay.status, pay.data?.success)

// Post-purchase downloads list (should have 1 row for this product)
const post = await fetch(`${BASE}/api/downloads?depth=2&sort=-createdAt&limit=20`, { headers: { Cookie: custCookie } }).then(j)
console.log('post-purchase downloads.length:', post.data?.docs?.length)
if (post.data?.docs?.[0]) {
  const dl = post.data.docs[0]
  console.log('  first download:', {
    id: dl.id,
    productName: typeof dl.product === 'object' ? dl.product.name : dl.product,
    downloadCount: dl.downloadCount,
    maxDownloads: dl.maxDownloads,
    expiresAt: dl.expiresAt,
  })
}
