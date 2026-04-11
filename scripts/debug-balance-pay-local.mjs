/**
 * Reproduce pay-with-balance 500 locally.
 */
const BASE = 'http://localhost:3000'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 1000) } }
}

const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const cookie = (login.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('login:', login.status)

// Fetch /me to see balance
const me = await fetch(`${BASE}/api/users/me`, { headers: { Cookie: cookie } }).then(j)
console.log('admin balance:', me.data?.user?.balance)

const p = await fetch(`${BASE}/api/products?limit=3`).then(j)
const product = p.data?.docs?.[0]
console.log('product:', product?.id, 'price:', product?.pricing?.price)

const order = await fetch(`${BASE}/api/payment/create-order`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ items: [{ productId: String(product.id) }], paymentMethod: 'balance' }),
}).then(j)
console.log('create-order:', order.status, JSON.stringify(order.data))

if (order.data?.orderId) {
  const pay = await fetch(`${BASE}/api/payment/pay-with-balance`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ orderId: order.data.orderId }),
  }).then(j)
  console.log('pay:', pay.status, JSON.stringify(pay.data || pay.text))
}
