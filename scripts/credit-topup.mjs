/**
 * Manually complete a pending topup and credit user balance.
 * Usage: node scripts/credit-topup.mjs <topupId> [bankRef]
 */
const BASE = process.env.BASE || 'https://www.thuvienso.top'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Anhdungpro1@'

const topupId = process.argv[2]
const bankRef = process.argv[3] || `MANUAL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`

if (!topupId) {
  console.error('Usage: node scripts/credit-topup.mjs <topupId> [bankRef]')
  process.exit(1)
}

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 500) } }
}

const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const cookie = (login.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
if (!cookie) { console.error('Login failed'); process.exit(1) }

const topup = await fetch(`${BASE}/api/topups/${topupId}`, { headers: { Cookie: cookie } }).then(j)
if (!topup.data?.id) { console.error('Topup not found:', topup.status, topup.data || topup.text); process.exit(1) }
const t = topup.data
console.log(`[topup ${t.id}] amount=${t.amount} status=${t.status} code=${t.transferCode}`)
if (t.status !== 'pending') { console.error('Topup not pending, abort. status=', t.status); process.exit(1) }

const userId = typeof t.user === 'object' ? t.user.id : t.user
const userRes = await fetch(`${BASE}/api/users/${userId}`, { headers: { Cookie: cookie } }).then(j)
if (!userRes.data?.id) { console.error('User not found'); process.exit(1) }
const u = userRes.data
console.log(`[user ${u.id}] email=${u.email} balance=${u.balance ?? 0}`)

const newBalance = (u.balance ?? 0) + t.amount

console.log('')
console.log('→ Will:')
console.log(`  1. Update topup ${t.id}: status=completed, bankTransactionId=${bankRef}, confirmedAt=now`)
console.log(`  2. Update user ${u.id} balance: ${u.balance ?? 0} → ${newBalance}`)
console.log('')

const t1 = await fetch(`${BASE}/api/topups/${t.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({
    status: 'completed',
    bankTransactionId: bankRef,
    bankDescription: `Manual credit — ${t.transferCode} (cron blocked: Web2M expired)`,
    confirmedAt: new Date().toISOString(),
  }),
}).then(j)
console.log('topup update:', t1.status, JSON.stringify(t1.data).slice(0, 300))

const t2 = await fetch(`${BASE}/api/users/${u.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ balance: newBalance }),
}).then(j)
console.log('user update:', t2.status, 'new balance =', t2.data?.doc?.balance ?? t2.data?.balance)

console.log('')
console.log('✓ DONE.')
