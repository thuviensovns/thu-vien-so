/**
 * E2E downloads test on PRODUCTION.
 * Creates fresh customer -> admin credit -> purchase -> verify downloads API.
 */
const BASE = 'https://www.thuvienso.top'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const CUST_EMAIL = `prod-dl-${Date.now()}@example.com`
const CUST_PASSWORD = 'Test1234!'

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 600) } }
}

// Admin login first (for backfill check)
const adminLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const adminCookie = (adminLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('admin login:', adminLogin.status)

// Admin view of all downloads (backfilled + new)
const allDl = await fetch(`${BASE}/api/downloads?depth=0&limit=50&sort=-createdAt`, { headers: { Cookie: adminCookie } }).then(j)
console.log('admin sees totalDocs:', allDl.data?.totalDocs, 'first 5 ids:', allDl.data?.docs?.slice(0, 5).map((d) => d.id))

// Register new customer
const reg = await fetch(`${BASE}/api/users`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD, displayName: 'Prod DL Test' }),
}).then(j)
console.log('register:', reg.status)

// Credit via admin
await fetch(`${BASE}/api/admin/topups`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ email: CUST_EMAIL, amount: 200000 }),
}).then(j).then((r) => console.log('admin credit:', JSON.stringify(r.data)))

// Customer login
const custLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD }),
})
const custCookie = (custLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('customer login:', custLogin.status)

// Pre-purchase
const pre = await fetch(`${BASE}/api/downloads?depth=1&sort=-createdAt&limit=20`, { headers: { Cookie: custCookie } }).then(j)
console.log('customer pre-purchase downloads.length:', pre.data?.docs?.length)

// Buy
const p = await fetch(`${BASE}/api/products?limit=3`).then(j)
const product = p.data?.docs?.[0]
console.log('buying:', product?.id, product?.name, 'price:', product?.pricing?.price)

const order = await fetch(`${BASE}/api/payment/create-order`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ items: [{ productId: String(product.id) }], paymentMethod: 'balance' }),
}).then(j)
console.log('create-order:', order.status, 'orderId:', order.data?.orderId)

const pay = await fetch(`${BASE}/api/payment/pay-with-balance`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ orderId: order.data.orderId }),
}).then(j)
console.log('pay:', pay.status, 'success:', pay.data?.success, 'token:', pay.data?.downloadToken?.slice(0, 8))

// Post-purchase
const post = await fetch(`${BASE}/api/downloads?depth=2&sort=-createdAt&limit=20`, { headers: { Cookie: custCookie } }).then(j)
console.log('customer post-purchase downloads.length:', post.data?.docs?.length)
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
