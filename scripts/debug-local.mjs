/**
 * Reproduce 500 error locally on dev server (port 3000).
 */
const BASE = 'http://localhost:3000'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'

const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const cookie = (login.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('login:', login.status)

const p = await fetch(`${BASE}/api/products?limit=3`)
const pData = await p.json()
const product = pData.docs?.[0]
console.log('product:', product?.id, product?.slug, 'price:', product?.pricing?.price)

const orderRes = await fetch(`${BASE}/api/payment/create-order`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ items: [{ productId: String(product.id) }], paymentMethod: 'balance' }),
})
const orderText = await orderRes.text()
console.log('\ncreate-order:', orderRes.status)
console.log('body:', orderText.slice(0, 1000))
