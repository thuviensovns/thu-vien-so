import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'
import { isValidPermission } from '@/lib/permissions'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(req, 'roles.view')
  if (guard instanceof NextResponse) return guard
  const { id } = await params
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(`SELECT * FROM admin_roles WHERE id = $1`, [id])
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ doc: rows[0] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(req, 'roles.edit')
  if (guard instanceof NextResponse) return guard
  const { id } = await params
  try {
    const body = await req.json()
    await ensureTablesExist()
    const pool = getDbPool()

    const existing = await pool.query(`SELECT * FROM admin_roles WHERE id = $1`, [id])
    if (existing.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const row = existing.rows[0]

    const sets: string[] = []
    const vals: unknown[] = []
    let i = 1

    if (typeof body?.description === 'string') {
      sets.push(`description = $${i++}`)
      vals.push(body.description)
    }
    if (Array.isArray(body?.permissions)) {
      // super_admin permissions always = ALL — do not allow editing
      if (row.name === 'super_admin') {
        return NextResponse.json({ error: 'Không thể sửa quyền của super_admin' }, { status: 400 })
      }
      const valid = (body.permissions as string[]).filter(
        (p) => typeof p === 'string' && isValidPermission(p),
      )
      sets.push(`permissions = $${i++}`)
      vals.push(valid)
    }
    if (typeof body?.name === 'string' && body.name.trim() && !row.is_system) {
      sets.push(`name = $${i++}`)
      vals.push(body.name.trim())
    }

    if (sets.length === 0) return NextResponse.json({ doc: row })

    sets.push(`updated_at = NOW()`)
    vals.push(id)
    const { rows } = await pool.query(
      `UPDATE admin_roles SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals,
    )
    return NextResponse.json({ doc: rows[0] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(req, 'roles.edit')
  if (guard instanceof NextResponse) return guard
  const { id } = await params
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const existing = await pool.query(`SELECT * FROM admin_roles WHERE id = $1`, [id])
    if (existing.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.rows[0].is_system) {
      return NextResponse.json({ error: 'Không thể xóa vai trò hệ thống' }, { status: 400 })
    }
    const assigned = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM user_role_assignments WHERE role_id = $1`,
      [id],
    )
    if (assigned.rows[0].cnt > 0) {
      return NextResponse.json(
        { error: `Đang có ${assigned.rows[0].cnt} user gán vai trò này. Hãy gỡ gán trước.` },
        { status: 400 },
      )
    }
    await pool.query(`DELETE FROM admin_roles WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
