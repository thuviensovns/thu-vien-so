import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'

/** POST: Admin deducts from a user's balance + creates topup audit row.
 *
 *  The topup row is inserted with NEGATIVE amount so any SUM-based aggregation
 *  (leaderboard, revenue analytics, dashboard totals) automatically nets out
 *  without per-query special-casing. We bypass `payload.create` because the
 *  TopUps collection enforces `min: 1000` on `amount`, which would block a
 *  signed value. Direct INSERT is safe — no hooks need to fire (the balance
 *  has already been deducted in step 1, and TopUps.afterChange only reacts to
 *  pending→completed transitions, not direct creates).
 */
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

    if (currentBalance < amount) {
      return NextResponse.json({
        error: `Số dư không đủ. Hiện có: ${currentBalance}₫, cần trừ: ${amount}₫`,
      }, { status: 400 })
    }

    // 1. Deduct user balance
    const newBalance = currentBalance - amount
    await payload.update({
      collection: 'users',
      id: targetUser.id,
      data: { balance: newBalance },
      overrideAccess: true,
    })

    // 2. Create audit row with NEGATIVE amount via raw SQL (bypasses min:1000).
    //    Pre-match the most recent positive topup of the same user with the
    //    same absolute amount so revenue analytics attribute this DEDUCT to
    //    the day of the original credit instead of "today" (admin-action day).
    //    LIFO heuristic — refunds typically correct the most recent mistake.
    //    Falls back to NULL if no exact-amount match (partial refund / wrong
    //    amount): aggregator uses DEDUCT's own date in that case.
    const transferCode = `DEDUCT${Date.now().toString(36).toUpperCase()}`
    const negAmount = -Math.abs(amount)
    const description = `[TRỪ TIỀN] Admin trừ ${amount}₫ bởi ${user.email}`

    const pool = getDbPool()
    // Priority 1: most recent topup with EXACT same amount (clean cộng→trừ pair)
    const { rows: exactMatch } = await pool.query(
      `SELECT id FROM topups
       WHERE user_id = $1
         AND amount = $2
         AND status = 'completed'
         AND (transfer_code IS NULL
           OR (transfer_code NOT LIKE 'DEDUCT%' AND transfer_code NOT LIKE 'COMM%'))
       ORDER BY created_at DESC LIMIT 1`,
      [targetUser.id, amount],
    )
    let originalTopupId: number | null = exactMatch[0]?.id ?? null
    // Priority 2: largest positive credit (best-guess for partial / bulk-undo)
    if (!originalTopupId) {
      const { rows: fallback } = await pool.query(
        `SELECT id FROM topups
         WHERE user_id = $1
           AND amount > 0
           AND status = 'completed'
           AND (transfer_code IS NULL
             OR (transfer_code NOT LIKE 'DEDUCT%' AND transfer_code NOT LIKE 'COMM%'))
         ORDER BY amount DESC, created_at DESC LIMIT 1`,
        [targetUser.id],
      )
      originalTopupId = fallback[0]?.id ?? null
    }

    await pool.query(
      `INSERT INTO topups
         (user_id, amount, transfer_code, status, confirmed_at, credited_at,
          bank_description, read_by_admin, original_topup_id, created_at, updated_at)
       VALUES ($1, $2, $3, 'completed', NOW(), NOW(), $4, true, $5, NOW(), NOW())`,
      [targetUser.id, negAmount, transferCode, description, originalTopupId],
    )

    return NextResponse.json({
      success: true,
      newBalance,
      transferCode,
      userName: targetUser.displayName || targetUser.email,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Admin deduct] Error:', msg, error)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
