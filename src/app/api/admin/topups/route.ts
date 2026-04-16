import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'

type Row = Record<string, unknown>

/** GET: List topups for admin page.
 *
 *  Polled every 15s by [quan-ly/nap-tien/page.tsx]. Uses raw SQL instead of
 *  Payload `find({ depth:1 })` so we avoid full-user hydration for a list view
 *  that only needs { email, displayName }.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const search = (req.nextUrl.searchParams.get('search') || '').trim()
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1)
    const limit = 50
    const offset = (page - 1) * limit
    const statusFilter = req.nextUrl.searchParams.get('status') || ''

    const conditions: string[] = []
    const params: unknown[] = []
    let i = 1

    if (search) {
      const like = `%${search}%`
      conditions.push(
        `(t.transfer_code ILIKE $${i} OR t.bank_description ILIKE $${i} OR t.bank_transaction_id ILIKE $${i})`,
      )
      params.push(like)
      i += 1
    }
    if (statusFilter && statusFilter !== 'all') {
      conditions.push(`t.status = $${i}`)
      params.push(statusFilter)
      i += 1
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const pool = getDbPool()

    const [{ rows: countRows }, { rows: docs }] = await Promise.all([
      pool.query<Row>(`SELECT COUNT(*)::int AS c FROM topups t ${whereSql}`, params),
      pool.query<Row>(
        `SELECT t.id, t.amount, t.transfer_code, t.status, t.bank_transaction_id,
                t.bank_description, t.confirmed_at, t.created_at, t.user_id,
                u.email AS user_email, u.display_name AS user_name
         FROM topups t
         LEFT JOIN users u ON u.id = t.user_id
         ${whereSql}
         ORDER BY t.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
    ])

    const totalDocs = Number(countRows[0]?.c || 0)
    const totalPages = Math.max(1, Math.ceil(totalDocs / limit))

    const res = NextResponse.json({
      docs: docs.map((t: Row) => ({
        id: t.id,
        userEmail: (t.user_email as string) || 'Unknown',
        userName: (t.user_name as string) || null,
        userId: t.user_id ?? null,
        amount: Number(t.amount || 0),
        transferCode: t.transfer_code,
        status: t.status,
        bankTransactionId: t.bank_transaction_id,
        bankDescription: (t.bank_description as string) || null,
        confirmedAt: t.confirmed_at,
        createdAt: t.created_at,
      })),
      totalDocs,
      totalPages,
      page,
    })
    res.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=15')
    return res
  } catch (error) {
    console.error('[Admin topups] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** POST: Admin manually credits a user's balance + creates topup record */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { email?: string; amount?: number }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const email = body.email?.trim()
    const amount = Number(body.amount)

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!amount || amount < 1000) {
      return NextResponse.json({ error: 'Số tiền tối thiểu 1.000₫' }, { status: 400 })
    }

    // Find user by email
    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })

    if (users.docs.length === 0) {
      return NextResponse.json({ error: `Không tìm thấy user với email: ${email}` }, { status: 404 })
    }

    const targetUser = users.docs[0]
    const currentBalance = Number(targetUser.balance || 0)

    // 1. Credit user balance
    await payload.update({
      collection: 'users',
      id: targetUser.id,
      data: { balance: currentBalance + amount },
      overrideAccess: true,
    })

    // 2. Create topup record
    const transferCode = `ADMIN${Date.now().toString(36).toUpperCase()}`
    try {
      await payload.create({
        collection: 'topups',
        data: {
          user: targetUser.id,
          amount,
          transferCode,
          status: 'completed',
          confirmedAt: new Date().toISOString(),
          readByAdmin: true,
          bankDescription: `Admin cộng thủ công bởi ${user.email}`,
        },
        overrideAccess: true,
      })
    } catch (topupErr) {
      // Retry without optional fields that may not exist in DB yet
      console.warn('[Admin topup] Retrying without optional fields:', topupErr)
      await payload.create({
        collection: 'topups',
        data: {
          user: targetUser.id,
          amount,
          transferCode,
          status: 'completed',
          confirmedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    }

    // 3. Accrue affiliate commission (no-op if feature disabled or user not referred)
    try {
      const { accrueCommission } = await import('@/lib/affiliate')
      await accrueCommission({
        referredUserId: Number(targetUser.id),
        baseAmount: amount,
        sourceType: 'topup',
        sourceId: transferCode,
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      newBalance: currentBalance + amount,
      transferCode,
      userName: targetUser.displayName || targetUser.email,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Admin manual topup] Error:', msg, error)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
