/**
 * Verify Phase 1 of the localStorage → DB migration:
 *   - /api/coupons/validate returns 404 for unknown codes
 *   - /api/coupons/validate returns discount for a valid code
 *   - /api/coupons/consume requires auth
 *   - /api/coupons/consume increments used_count
 *   - Purchase flow no longer relies on localStorage shadow-writes
 *     (order appears in /api/orders for authenticated customer)
 */
const BASE = process.env.BASE || 'http://localhost:3001'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const CUST_EMAIL = `test-coupon-${Date.now()}@example.com`
const CUST_PASSWORD = 'Test1234!'
const COUPON_CODE = `TEST${Date.now().toString(36).toUpperCase().slice(-6)}`

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, text: text.slice(0, 300) } }
}

function check(label, ok, detail) {
  console.log(`   ${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ' — ' + detail : ''}`)
  return ok ? 0 : 1
}

console.log('=== Coupons API + purchase flow integration ===')
let failed = 0

// 1. Admin login + top up
const adminLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const adminCookie = (adminLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
if (!adminCookie) { console.error('FAIL: admin login'); process.exit(1) }
console.log('1. admin login: OK')

// 2. Create a coupon via admin API
const createRes = await fetch(`${BASE}/api/admin/coupons`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ code: COUPON_CODE, type: 'percent', value: 10, minOrder: 10000, maxUses: 5 }),
}).then(j)
console.log(`2. created coupon ${COUPON_CODE}: ${createRes.status}`)
if (createRes.status !== 200) { console.error('FAIL: coupon create', createRes.data); process.exit(1) }
const couponId = createRes.data?.coupon?.id
console.log(`   id=${couponId}`)

// 3. /api/coupons/validate with unknown code → 404
const unknown = await fetch(`${BASE}/api/coupons/validate?code=XYZNOTREAL&total=100000`).then(j)
failed += check('validate unknown → 404', unknown.status === 404)

// 4. /api/coupons/validate with valid code
const valid = await fetch(`${BASE}/api/coupons/validate?code=${COUPON_CODE}&total=100000`).then(j)
failed += check('validate valid → 200', valid.status === 200)
failed += check('discount = 10% of 100k', valid.data?.discount === 10000, `got ${valid.data?.discount}`)

// 5. /api/coupons/validate with order < minOrder → 400
const tooSmall = await fetch(`${BASE}/api/coupons/validate?code=${COUPON_CODE}&total=5000`).then(j)
failed += check('validate below min_order → 400', tooSmall.status === 400)

// 6. /api/coupons/consume anonymous → 401
const anonConsume = await fetch(`${BASE}/api/coupons/consume`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: couponId }),
}).then(j)
failed += check('anonymous consume → 401', anonConsume.status === 401)

// 7. Register customer + top up balance
await fetch(`${BASE}/api/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD, displayName: 'Coupon Test' }),
}).then(j)
await fetch(`${BASE}/api/admin/topups`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ email: CUST_EMAIL, amount: 200000 }),
}).then(j)
const custLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD }),
})
const custCookie = (custLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('7. customer registered + login')

// 8. Authenticated consume → 200 and increments used_count
const consume = await fetch(`${BASE}/api/coupons/consume`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ id: couponId }),
}).then(j)
failed += check('customer consume → 200', consume.status === 200)
failed += check('used_count = 1', consume.data?.usedCount === 1, `got ${consume.data?.usedCount}`)

// 9. Validate again → should show usedCount=1
const reValidate = await fetch(`${BASE}/api/coupons/validate?code=${COUPON_CODE}&total=100000`).then(j)
failed += check('re-validate shows used_count=1', reValidate.data?.usedCount === 1, `got ${reValidate.data?.usedCount}`)

// 10. Buy a product → order persists in DB (no localStorage)
const prods = await fetch(`${BASE}/api/products?limit=5&depth=0`).then(j)
const product = prods.data?.docs?.[0]
if (!product) { console.error('FAIL: no product'); process.exit(1) }

const order = await fetch(`${BASE}/api/payment/create-order`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ items: [{ productId: String(product.id) }], paymentMethod: 'balance' }),
}).then(j)
const pay = await fetch(`${BASE}/api/payment/pay-with-balance`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ orderId: order.data?.orderId }),
}).then(j)
failed += check('payment → 200', pay.status === 200)

// 11. Order appears in /api/orders for the customer
const myOrders = await fetch(`${BASE}/api/orders?depth=1&sort=-createdAt&limit=5`, {
  headers: { Cookie: custCookie },
}).then(j)
const foundOrder = (myOrders.data?.docs || []).find((o) => o.orderNumber === pay.data?.orderNumber)
failed += check('order in DB /api/orders', !!foundOrder, foundOrder?.orderNumber)

// 12. Clean up: delete coupon
await fetch(`${BASE}/api/admin/coupons?id=${couponId}`, {
  method: 'DELETE',
  headers: { Cookie: adminCookie },
})

if (failed > 0) { console.error(`\n=== ${failed} checks FAILED ===`); process.exit(1) }
console.log('\n=== ALL PASS: coupons API + purchase flow fully DB-backed ===')
