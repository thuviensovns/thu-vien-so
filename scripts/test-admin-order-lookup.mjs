/**
 * E2E: admin looks up an order by code -> sees customer info + stats.
 */
const BASE = process.env.BASE || 'http://localhost:3001'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const CUST_EMAIL = process.env.CUST_EMAIL || `test-lookup-${Date.now()}@example.com`
const CUST_PASSWORD = 'Test1234!'

console.log('=== Admin Order Lookup E2E ===')
console.log('BASE:', BASE)
console.log('Customer:', CUST_EMAIL)

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, text: text.slice(0, 400) } }
}

// 1. Register customer
await fetch(`${BASE}/api/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD, displayName: 'Lookup Test' }),
}).then(j)
console.log('1. register ok')

// 2. Admin login
const adminLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const adminCookie = (adminLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('2. admin login:', adminLogin.status)

// 3. Admin credits the customer
await fetch(`${BASE}/api/admin/topups`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ email: CUST_EMAIL, amount: 200000 }),
}).then(j)
console.log('3. topup ok')

// 4. Customer login + buy
const custLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD }),
})
const custCookie = (custLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''

const p = await fetch(`${BASE}/api/products?limit=3`).then(j)
const product = p.data?.docs?.[0]
const order = await fetch(`${BASE}/api/payment/create-order`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ items: [{ productId: String(product.id) }], paymentMethod: 'balance' }),
}).then(j)
console.log('4. create-order:', order.status, 'orderNumber:', order.data?.orderNumber || order.data?.orderId)

const pay = await fetch(`${BASE}/api/payment/pay-with-balance`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ orderId: order.data.orderId }),
}).then(j)
console.log('5. pay:', pay.status, pay.data?.success)

// Get the orderNumber — fetch from admin orders list
const list = await fetch(`${BASE}/api/admin/orders?search=${encodeURIComponent(CUST_EMAIL)}`, {
  headers: { Cookie: adminCookie },
}).then(j)
const targetOrder = list.data?.docs?.[0]
if (!targetOrder) { console.error('FAIL: cannot find order for customer'); process.exit(1) }
const orderNumber = targetOrder.orderNumber
console.log('6. found orderNumber:', orderNumber)

// 7. TEST: admin lookup by code
const lookup = await fetch(`${BASE}/api/admin/orders/lookup/${encodeURIComponent(orderNumber)}`, {
  headers: { Cookie: adminCookie },
}).then(j)
console.log('7. lookup:', lookup.status)
if (lookup.status !== 200) { console.error('FAIL:', lookup.data); process.exit(1) }

console.log('   order.orderNumber:', lookup.data.order?.orderNumber)
console.log('   order.total:', lookup.data.order?.total)
console.log('   order.status:', lookup.data.order?.status)
console.log('   order.items:', lookup.data.order?.items?.length)
console.log('   customer.email:', lookup.data.customer?.email)
console.log('   customer.displayName:', lookup.data.customer?.displayName)
console.log('   customer.balance:', lookup.data.customer?.balance)
console.log('   customer.stats.totalOrders:', lookup.data.customer?.stats?.totalOrders)
console.log('   customer.stats.paidOrders:', lookup.data.customer?.stats?.paidOrders)
console.log('   customer.stats.totalSpent:', lookup.data.customer?.stats?.totalSpent)

// Assertions
const checks = [
  ['orderNumber matches', lookup.data.order?.orderNumber === orderNumber],
  ['customer.email matches', lookup.data.customer?.email === CUST_EMAIL],
  ['customer.displayName set', lookup.data.customer?.displayName === 'Lookup Test'],
  ['totalOrders >= 1', (lookup.data.customer?.stats?.totalOrders || 0) >= 1],
  ['paidOrders >= 1', (lookup.data.customer?.stats?.paidOrders || 0) >= 1],
  ['totalSpent > 0', (lookup.data.customer?.stats?.totalSpent || 0) > 0],
  ['order.items count >= 1', (lookup.data.order?.items?.length || 0) >= 1],
]

let failed = 0
for (const [label, ok] of checks) {
  console.log(`   ${ok ? 'PASS' : 'FAIL'}: ${label}`)
  if (!ok) failed += 1
}

// 8. Test non-admin access rejection
const custLookup = await fetch(`${BASE}/api/admin/orders/lookup/${encodeURIComponent(orderNumber)}`, {
  headers: { Cookie: custCookie },
}).then(j)
console.log('8. customer tried lookup:', custLookup.status, '(expected 403)')
if (custLookup.status !== 403) {
  console.error('FAIL: non-admin access not rejected')
  failed += 1
}

// 9. Test 404 for missing code
const missing = await fetch(`${BASE}/api/admin/orders/lookup/TVS-DOES-NOT-EXIST-${Date.now()}`, {
  headers: { Cookie: adminCookie },
}).then(j)
console.log('9. missing code:', missing.status, '(expected 404)')
if (missing.status !== 404) {
  console.error('FAIL: missing code should return 404')
  failed += 1
}

if (failed > 0) { console.error(`\n=== ${failed} checks failed ===`); process.exit(1) }
console.log('\n=== PASS: order lookup works end-to-end ===')
