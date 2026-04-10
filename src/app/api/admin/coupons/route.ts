import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'

async function requireAdmin(req: NextRequest) {
  const payload = await getPayloadForApi()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || user.role !== 'admin') return null
  return user
}

/** GET: List all coupons */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(
      `SELECT * FROM coupons ORDER BY created_at DESC LIMIT 200`
    )
    return NextResponse.json({
      docs: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        code: r.code,
        type: r.type || 'percent',
        value: Number(r.value) || 0,
        minOrder: Number(r.min_order) || 0,
        maxUses: Number(r.max_uses) || 0,
        usedCount: Number(r.used_count) || 0,
        active: r.active !== false,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      })),
    })
  } catch (error) {
    console.error('[Admin coupons] GET error:', error)
    // Table might not exist yet
    return NextResponse.json({ docs: [] })
  }
}

/** POST: Create a new coupon */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    let body: { code?: string; type?: string; value?: number; minOrder?: number; maxUses?: number; expiresAt?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body.code?.trim()) {
      return NextResponse.json({ error: 'Mã giảm giá là bắt buộc' }, { status: 400 })
    }

    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(
      `INSERT INTO coupons (code, type, value, min_order, max_uses, active, expires_at)
       VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING *`,
      [
        body.code.toUpperCase().trim(),
        body.type || 'percent',
        body.value || 0,
        body.minOrder || 0,
        body.maxUses || 0,
        body.expiresAt || null,
      ]
    )
    return NextResponse.json({ success: true, coupon: rows[0] })
  } catch (error) {
    console.error('[Admin coupons] POST error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

/** PATCH: Toggle coupon active state */
export async function PATCH(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    let body: { id?: number; active?: boolean }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body.id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    const pool = getDbPool()
    await pool.query(`UPDATE coupons SET active = $1, updated_at = NOW() WHERE id = $2`, [body.active ?? false, body.id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin coupons] PATCH error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

/** DELETE: Delete a coupon */
export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    const pool = getDbPool()
    await pool.query(`DELETE FROM coupons WHERE id = $1`, [Number(id)])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin coupons] DELETE error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
