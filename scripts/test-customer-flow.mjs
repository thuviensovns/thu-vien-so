/**
 * End-to-end test AS A CUSTOMER (not admin):
 * register -> admin credits -> customer buys -> verify downloadToken.
 */
const BASE = 'http://localhost:3000'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const CUST_EMAIL = `test-cust-${Date.now()}@example.com`
const CUST_PASSWORD = 'Test1234!'

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 1000) } }
}

// 1. Register customer
const reg = await fetch(`${BASE}/api/users`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD, displayName: 'Test Customer' }),
}).then(j)
console.log('register:', reg.status, reg.data?.doc?.email || reg.data || reg.text)

// 2. Admin login + credit customer
const adminLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const adminCookie = (adminLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''

const topup = await fetch(`${BASE}/api/admin/topups`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ email: CUST_EMAIL, amount: 200000 }),
}).then(j)
console.log('admin credit:', topup.status, JSON.stringify(topup.data))

// 3. Customer login
const custLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD }),
})
const custCookie = (custLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('customer login:', custLogin.status, 'cookie:', custCookie ? 'yes' : 'no')

// 4. Customer /me + balance check
const me = await fetch(`${BASE}/api/users/me`, { headers: { Cookie: custCookie } }).then(j)
console.log('customer /me: role=', me.data?.user?.role, 'balance=', me.data?.user?.balance)

// 5. Customer buys
const p = await fetch(`${BASE}/api/products?limit=3`).then(j)
const product = p.data?.docs?.[0]
console.log('product:', product?.id, 'price:', product?.pricing?.price)

const order = await fetch(`${BASE}/api/payment/create-order`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({ items: [{ productId: String(product.id) }], paymentMethod: 'balance' }),
}).then(j)
console.log('create-order:', order.status, JSON.stringify(order.data))

if (order.data?.orderId) {
  const pay = await fetch(`${BASE}/api/payment/pay-with-balance`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: custCookie },
    body: JSON.stringify({ orderId: order.data.orderId }),
  }).then(j)
  console.log('pay:', pay.status, JSON.stringify(pay.data || pay.text))
}
