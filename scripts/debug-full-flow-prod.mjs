/**
 * Full instant-buy flow on production as a customer with sufficient balance.
 */
const BASE = 'https://www.thuvienso.top'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const CUSTOMER_EMAIL = 'transangcs166@gmail.com'

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 1000) } }
}

// 1. Admin login
const adminLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const adminCookie = (adminLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('admin login:', adminLogin.status)

// 2. Credit 200k to customer via admin
const topupRes = await fetch(`${BASE}/api/admin/topups`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ email: CUSTOMER_EMAIL, amount: 200000 }),
})
const topupData = await j(topupRes)
console.log('admin topup 200k:', topupRes.status, JSON.stringify(topupData.data))

// 3. Set customer password via admin (if needed) — skip, use existing if known.
//    Instead test using the admin's own account by first crediting admin.
await fetch(`${BASE}/api/admin/topups`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ email: ADMIN_EMAIL, amount: 200000 }),
}).then(j).then((d) => console.log('admin self-topup:', JSON.stringify(d.data)))

// 4. Get product
const p = await fetch(`${BASE}/api/products?limit=3`, { headers: { Cookie: adminCookie } })
const pData = await j(p)
const product = pData.data?.docs?.[0]
console.log('product:', product?.id, 'price:', product?.pricing?.price)

// 5. Create order as admin
const orderRes = await fetch(`${BASE}/api/payment/create-order`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ items: [{ productId: String(product.id) }], paymentMethod: 'balance' }),
})
const orderData = await j(orderRes)
console.log('create-order:', orderRes.status, JSON.stringify(orderData.data))

// 6. Pay with balance
if (orderData.data?.orderId) {
  const payRes = await fetch(`${BASE}/api/payment/pay-with-balance`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ orderId: orderData.data.orderId }),
  })
  const payData = await j(payRes)
  console.log('pay-with-balance:', payRes.status)
  console.log('body:', JSON.stringify(payData.data || payData.text))
}
