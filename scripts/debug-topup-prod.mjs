/**
 * Test admin topup endpoint on production.
 */
const BASE = 'https://www.thuvienso.top'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 1000) } }
}

console.log('1. Login admin...')
const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const cookie = (login.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('   status:', login.status, 'cookie:', cookie ? 'yes' : 'no')

console.log('\n2. Fetch user list, pick a customer...')
const uRes = await fetch(`${BASE}/api/users?limit=500`, { headers: { Cookie: cookie } })
const uData = await j(uRes)
console.log('   totalDocs:', uData.data?.totalDocs)
const customer = uData.data?.docs?.find((u) => u.role !== 'admin') || uData.data?.docs?.[0]
console.log('   target:', customer?.email, 'balance:', customer?.balance)

console.log('\n3. POST /api/admin/topups { email, amount: 10000 }')
const topupRes = await fetch(`${BASE}/api/admin/topups`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ email: customer.email, amount: 10000 }),
})
const topupData = await j(topupRes)
console.log('   status:', topupRes.status)
console.log('   body:', JSON.stringify(topupData.data || topupData.text))

console.log('\n4. Re-fetch customer to verify balance updated...')
const u2 = await fetch(`${BASE}/api/users?limit=500`, { headers: { Cookie: cookie } })
const u2Data = await j(u2)
const updatedCustomer = u2Data.data?.docs?.find((u) => u.email === customer.email)
console.log('   balance after:', updatedCustomer?.balance)
