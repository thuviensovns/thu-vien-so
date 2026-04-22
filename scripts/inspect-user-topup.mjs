/**
 * Inspect a user's balance + recent topups to decide manual credit.
 * Usage: node scripts/inspect-user-topup.mjs <email>
 */
const BASE = process.env.BASE || 'https://www.thuvienso.top'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Anhdungpro1@'

const targetEmail = process.argv[2]
if (!targetEmail) {
  console.error('Usage: node scripts/inspect-user-topup.mjs <email>')
  process.exit(1)
}

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } } catch { return { status: res.status, text: text.slice(0, 500) } }
}

const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const cookie = (login.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
if (!cookie) { console.error('Login failed:', login.status, await login.text()); process.exit(1) }
console.log(`[login] ${BASE} → OK`)

const usersRes = await fetch(`${BASE}/api/users?where[email][equals]=${encodeURIComponent(targetEmail)}&limit=5`, { headers: { Cookie: cookie } }).then(j)
const user = usersRes.data?.docs?.[0]
if (!user) { console.error('User not found:', targetEmail); process.exit(1) }

console.log('')
console.log('=== USER ===')
console.log('  id:       ', user.id)
console.log('  email:    ', user.email)
console.log('  balance:  ', user.balance ?? 0, 'VND')
console.log('  createdAt:', user.createdAt)

const topupsRes = await fetch(
  `${BASE}/api/topups?where[user][equals]=${user.id}&sort=-createdAt&limit=10`,
  { headers: { Cookie: cookie } }
).then(j)

console.log('')
console.log('=== RECENT TOPUPS ===')
const topups = topupsRes.data?.docs || []
if (topups.length === 0) {
  console.log('  (none)')
} else {
  for (const t of topups) {
    console.log(`  #${t.id} | ${t.createdAt} | ${t.amount} VND | status=${t.status} | code=${t.transferCode} | bankTxId=${t.bankTransactionId || '-'}`)
  }
}

console.log('')
console.log('=== SUGGESTION ===')
const pending = topups.find(t => t.status === 'pending')
if (pending) {
  console.log(`  → User has PENDING topup #${pending.id} (${pending.amount} VND, code=${pending.transferCode})`)
  console.log(`  → If they really paid, complete this topup + credit balance.`)
} else {
  console.log('  → No pending topup. Need to create a fresh topup row (manual credit).')
}
