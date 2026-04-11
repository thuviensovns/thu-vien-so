/**
 * E2E: customer sends contact message -> admin replies -> customer sees reply
 * Proves the full admin-reply -> customer-see flow works end-to-end.
 */
const BASE = process.env.BASE || 'http://localhost:3001'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'
const CUST_EMAIL = process.env.CUST_EMAIL || `test-reply-${Date.now()}@example.com`
const CUST_PASSWORD = 'Test1234!'

console.log('=== Admin Reply E2E ===')
console.log('BASE:', BASE)
console.log('Customer:', CUST_EMAIL)

async function j(res) {
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, text: text.slice(0, 400) } }
}

// 1. Register customer (ignore if exists)
const reg = await fetch(`${BASE}/api/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD, displayName: 'Reply Test' }),
}).then(j)
console.log('1. register:', reg.status)

// 2. Customer login
const custLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: CUST_EMAIL, password: CUST_PASSWORD }),
})
const custCookie = (custLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('2. customer login:', custLogin.status, custCookie ? 'OK' : 'NO COOKIE')

// 3. Customer sends contact message
const sent = await fetch(`${BASE}/api/contact`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: custCookie },
  body: JSON.stringify({
    name: 'Reply Test',
    email: CUST_EMAIL,
    subject: 'Test reply flow',
    message: 'Please reply to confirm this works',
  }),
}).then(j)
console.log('3. send contact:', sent.status, sent.data?.success ? 'OK' : 'FAIL')
if (!sent.data?.success) { console.error('   data:', sent.data); process.exit(1) }

// 4. Admin login
const adminLogin = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const adminCookie = (adminLogin.headers.get('set-cookie') || '').match(/payload-token=[^;]+/)?.[0] || ''
console.log('4. admin login:', adminLogin.status, adminCookie ? 'OK' : 'NO COOKIE')

// 5. Admin fetches notifications (finds the new message)
const notif = await fetch(`${BASE}/api/notifications`, {
  headers: { Cookie: adminCookie },
}).then(j)
console.log('5. notifications:', notif.status, 'recent:', notif.data?.recent?.length)
const target = notif.data?.recent?.find((m) => m.email === CUST_EMAIL)
if (!target) { console.error('   FAIL: message not found in notifications'); process.exit(1) }
console.log('   found message id:', target.id)

// 6. Admin clicks message (auto-patch to processing) — simulates the race
const patchProcessing = await fetch(`${BASE}/api/messages/${target.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ status: 'processing' }),
}).then(j)
console.log('6. auto-patch to processing:', patchProcessing.status, 'status:', patchProcessing.data?.status)

// 7. Admin saves adminNote (the reply)
const replyText = 'Cảm ơn bạn đã liên hệ. Đây là phản hồi của admin.'
const patchReply = await fetch(`${BASE}/api/messages/${target.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
  body: JSON.stringify({ adminNote: replyText, status: 'replied' }),
}).then(j)
console.log('7. save reply:', patchReply.status, 'status:', patchReply.data?.status)
console.log('   adminNote:', patchReply.data?.adminNote)
if (patchReply.status !== 200) { console.error('   FAIL'); process.exit(1) }
if (patchReply.data?.adminNote !== replyText) {
  console.error('   FAIL: adminNote mismatch')
  console.error('   expected:', replyText)
  console.error('   got:', patchReply.data?.adminNote)
  process.exit(1)
}

// 8. Customer fetches /api/my-messages — must see the reply
const myMsgs = await fetch(`${BASE}/api/my-messages`, {
  headers: { Cookie: custCookie },
}).then(j)
console.log('8. customer my-messages:', myMsgs.status, 'count:', myMsgs.data?.totalDocs)
const replied = myMsgs.data?.messages?.find((m) => m.id === target.id)
if (!replied) { console.error('   FAIL: customer cannot see their message'); process.exit(1) }
console.log('   status:', replied.status)
console.log('   adminNote:', replied.adminNote)
if (replied.adminNote !== replyText) {
  console.error('   FAIL: customer sees wrong adminNote')
  process.exit(1)
}

console.log('\n=== PASS: admin reply flow works end-to-end ===')
