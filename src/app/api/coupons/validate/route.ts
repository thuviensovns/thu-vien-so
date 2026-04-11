import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'

export const dynamic = 'force-dynamic'

/**
 * GET /api/coupons/validate?code=XYZ&total=100000
 *
 * Customer-facing read of the `coupons` table. Returns the coupon + computed
 * discount for the given order total, or a 404/400 error if the code is not
 * usable. No side effects — call `/api/coupons/consume` after payment succeeds.
 */
export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get('code') || '').trim().toUpperCase()
    const total = Number(req.nextUrl.searchParams.get('total') || 0)

    if (!code || code.length > 50 || /[<>"'`;]/.test(code)) {
      return NextResponse.json({ error: 'Mã giảm giá không hợp lệ' }, { status: 400 })
    }

    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(
      `SELECT * FROM coupons WHERE UPPER(code) = $1 LIMIT 1`,
      [code]
    )
    const row = rows[0]
    if (!row) {
      return NextResponse.json({ error: 'Mã giảm giá không tồn tại' }, { status: 404 })
    }
    if (row.active === false) {
      return NextResponse.json({ error: 'Mã giảm giá đã hết hiệu lực' }, { status: 410 })
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Mã giảm giá đã hết hạn' }, { status: 410 })
    }
    const maxUses = Number(row.max_uses) || 0
    const usedCount = Number(row.used_count) || 0
    if (maxUses > 0 && usedCount >= maxUses) {
      return NextResponse.json({ error: 'Mã giảm giá đã hết lượt sử dụng' }, { status: 410 })
    }
    const minOrder = Number(row.min_order) || 0
    if (minOrder > 0 && total < minOrder) {
      return NextResponse.json({
        error: `Đơn hàng tối thiểu ${minOrder.toLocaleString('vi-VN')}đ để dùng mã này`,
      }, { status: 400 })
    }

    const type: 'percent' | 'fixed' = row.type === 'fixed' ? 'fixed' : 'percent'
    const value = Number(row.value) || 0
    const discount = type === 'percent'
      ? Math.round(total * value / 100)
      : Math.min(value, total)

    return NextResponse.json({
      id: row.id,
      code: row.code,
      type,
      value,
      minOrder,
      maxUses,
      usedCount,
      discount,
    })
  } catch (error) {
    console.error('[coupons/validate] error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
