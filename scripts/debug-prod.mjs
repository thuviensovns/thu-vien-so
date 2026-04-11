/**
 * Debug production issues: admin users list + instant-buy.
 * Hits https://www.thuvienso.top with admin credentials.
 */
const BASE = 'https://www.thuvienso.top'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 500) } }
}

console.log('1. Login as admin...')
const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const setCookie = login.headers.get('set-cookie') || ''
const cookie = setCookie.match(/payload-token=[^;]+/)?.[0] || ''
console.log('   login:', login.status, 'cookie:', cookie ? 'yes' : 'no')
if (!cookie) {
  console.log('   cannot proceed without cookie')
  console.log('   response:', await login.text())
  process.exit(1)
}

console.log('\n2. GET /api/users?limit=500 as admin...')
const u = await fetch(`${BASE}/api/users?limit=500&sort=-createdAt`, { headers: { Cookie: cookie } })
const uData = await j(u)
console.log('   status:', uData.status)
if (uData.data) {
  console.log('   totalDocs:', uData.data.totalDocs, 'docs.length:', uData.data.docs?.length)
  if (uData.data.docs?.[0]) {
    console.log('   first doc:', JSON.stringify({
      id: uData.data.docs[0].id,
      email: uData.data.docs[0].email,
      balance: uData.data.docs[0].balance,
    }))
  }
  if (uData.data.errors) console.log('   errors:', JSON.stringify(uData.data.errors))
} else {
  console.log('   text:', uData.text)
}

console.log('\n3. GET /api/users/me as admin...')
const me = await fetch(`${BASE}/api/users/me`, { headers: { Cookie: cookie } })
const meData = await j(me)
console.log('   status:', meData.status)
console.log('   user:', JSON.stringify(meData.data?.user, null, 2))

console.log('\n4. GET /api/products?limit=3...')
const p = await fetch(`${BASE}/api/products?limit=3`, { headers: { Cookie: cookie } })
const pData = await j(p)
console.log('   status:', pData.status, 'docs:', pData.data?.docs?.length)
const product = pData.data?.docs?.[0]
if (product) {
  console.log('   first product id:', product.id, 'slug:', product.slug, 'price:', product.pricing?.price)
}

console.log('\n5. GET /api/balance as admin...')
const bal = await fetch(`${BASE}/api/balance`, { headers: { Cookie: cookie } })
const balData = await j(bal)
console.log('   status:', balData.status, 'body:', JSON.stringify(balData.data || balData.text))

if (product) {
  console.log('\n6. POST /api/payment/create-order { items: [{productId}], paymentMethod: balance }')
  const orderRes = await fetch(`${BASE}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ items: [{ productId: String(product.id) }], paymentMethod: 'balance' }),
  })
  const orderData = await j(orderRes)
  console.log('   status:', orderData.status, 'body:', JSON.stringify(orderData.data || orderData.text).slice(0, 500))

  if (orderData.data?.orderId) {
    console.log('\n7. POST /api/payment/pay-with-balance { orderId }')
    const payRes = await fetch(`${BASE}/api/payment/pay-with-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ orderId: orderData.data.orderId }),
    })
    const payData = await j(payRes)
    console.log('   status:', payData.status, 'body:', JSON.stringify(payData.data || payData.text).slice(0, 500))
  }
}
