/**
 * Reconcile Orphaned Bank Transfer Orders
 *
 * Finds pending bank-transfer orders from 2026-04-13 that were never
 * matched by the webhook because the old checkout page generated
 * client-side DH... codes that didn't match the MUS-... codes in DB.
 *
 * Usage: node scripts/reconcile-orphaned-orders.mjs
 *
 * Requires: PAYLOAD_SECRET, DATABASE_URI in .env.local
 */

import 'dotenv/config'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('❌ Set ADMIN_EMAIL and ADMIN_PASSWORD env vars')
  process.exit(1)
}

// Login as admin
async function login() {
  const res = await fetch(`${SITE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (!res.ok) throw new Error('Login failed')
  const data = await res.json()
  return data.token
}

async function main() {
  console.log('🔍 Reconciling orphaned bank-transfer orders...\n')

  const token = await login()
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `JWT ${token}`,
  }

  // 1. Find ALL pending bank-transfer orders
  const ordersRes = await fetch(`${SITE_URL}/api/orders?where[status][equals]=pending&where[payment__method][equals]=bank-transfer&sort=-createdAt&limit=50&depth=1`, { headers })
  const ordersData = await ordersRes.json()

  if (!ordersData.docs?.length) {
    console.log('✅ No pending bank-transfer orders found.')
    return
  }

  console.log(`📋 Found ${ordersData.docs.length} pending bank-transfer orders:\n`)
  console.log('─'.repeat(100))
  console.log(
    'Order Number'.padEnd(25),
    'User'.padEnd(30),
    'Total'.padEnd(12),
    'Transfer Code'.padEnd(15),
    'Created At'
  )
  console.log('─'.repeat(100))

  for (const order of ordersData.docs) {
    const user = typeof order.user === 'object' ? order.user : null
    const userName = user?.displayName || user?.email || `ID:${order.user}`
    const total = Number(order.total || 0).toLocaleString('vi-VN')
    const transferCode = order.transferCode || '(none)'
    const createdAt = new Date(order.createdAt).toLocaleString('vi-VN')

    console.log(
      String(order.orderNumber).padEnd(25),
      String(userName).padEnd(30),
      `${total}đ`.padEnd(12),
      String(transferCode).padEnd(15),
      createdAt
    )
  }

  console.log('─'.repeat(100))

  // 2. Check user ID 38 (NAPKH0038)
  console.log('\n🔍 Checking NAPKH0038 (User ID 38)...')
  try {
    const userRes = await fetch(`${SITE_URL}/api/users/38?depth=0`, { headers })
    if (userRes.ok) {
      const userData = await userRes.json()
      console.log(`  ✅ User 38: ${userData.displayName || userData.email}`)
      console.log(`     Email: ${userData.email}`)
      console.log(`     Balance: ${Number(userData.balance || 0).toLocaleString('vi-VN')}đ`)
    } else {
      console.log('  ❌ User ID 38 not found')
    }
  } catch (e) {
    console.log('  ❌ Error fetching user 38:', e.message)
  }

  // 3. Check topups for NAPKH0038
  console.log('\n🔍 Checking topups with NAPKH0038...')
  const topupsRes = await fetch(`${SITE_URL}/api/topups?where[transferCode][contains]=NAPKH0038&sort=-createdAt&limit=10&depth=1`, { headers })
  const topupsData = await topupsRes.json()

  if (topupsData.docs?.length) {
    for (const t of topupsData.docs) {
      console.log(`  ${t.status === 'completed' ? '✅' : '⏳'} ${t.transferCode} — ${Number(t.amount).toLocaleString('vi-VN')}đ — ${t.status} — ${new Date(t.createdAt).toLocaleString('vi-VN')}`)
    }
  } else {
    console.log('  ⚠️  No topups found for NAPKH0038')
  }

  // 4. Summary of unmatched DH codes
  console.log('\n' + '═'.repeat(100))
  console.log('📊 SUMMARY — Unmatched DH Transfer Codes')
  console.log('═'.repeat(100))

  const dhCodes = [
    'DH202604133LW7T3',
    'DH20260413|Y9GDW',
    'DH20260413LITPP8',
    'DH202604139A1VWP',
    'DH20260413MSCF18',
    'DH202604131JHXUX',
  ]

  console.log('\nThese DH codes were generated CLIENT-SIDE by the OLD checkout page.')
  console.log('They were shown in QR codes but NEVER saved to the database.')
  console.log('The orders were created in DB with MUS-... format instead.\n')
  console.log('To reconcile: match bank transfer AMOUNTS with pending order TOTALS above.')
  console.log('Then manually mark the matched orders as paid via admin panel (/quan-ly/don-hang).\n')

  for (const code of dhCodes) {
    console.log(`  ❌ ${code} — not in database (client-side generated)`)
  }

  console.log('\n  ℹ️  NAPKH0038 — should be auto-processed (check above)')
  console.log('  ℹ️  MOMO transaction — different payment channel, not bank transfer')
}

main().catch(console.error)
