import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'

export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'roles.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const roleId = req.nextUrl.searchParams.get('role_id')
    const userId = req.nextUrl.searchParams.get('user_id')

    if (userId) {
      const { rows } = await pool.query(
        `SELECT a.user_id, a.role_id, a.assigned_at, a.assigned_by, r.name, r.permissions, r.description
         FROM user_role_assignments a JOIN admin_roles r ON r.id = a.role_id
         WHERE a.user_id = $1 LIMIT 1`,
        [userId],
      )
      return NextResponse.json({ assignment: rows[0] || null })
    }

    if (roleId) {
      const { rows } = await pool.query(
        `SELECT user_id, assigned_at, assigned_by FROM user_role_assignments WHERE role_id = $1`,
        [roleId],
      )
      return NextResponse.json({ docs: rows })
    }

    const { rows } = await pool.query(
      `SELECT a.user_id, a.role_id, a.assigned_at, a.assigned_by, r.name AS role_name
       FROM user_role_assignments a JOIN admin_roles r ON r.id = a.role_id
       ORDER BY a.assigned_at DESC`,
    )
    return NextResponse.json({ docs: rows })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, 'users.assign_role')
  if (guard instanceof NextResponse) return guard
  try {
    const body = await req.json()
    const userId = Number(body?.user_id)
    const roleId = body?.role_id === null ? null : Number(body?.role_id)
    if (!userId) return NextResponse.json({ error: 'Thiếu user_id' }, { status: 400 })

    await ensureTablesExist()
    const pool = getDbPool()

    if (roleId === null) {
      await pool.query(`DELETE FROM user_role_assignments WHERE user_id = $1`, [userId])
      return NextResponse.json({ success: true, cleared: true })
    }

    const roleRes = await pool.query(`SELECT id, name FROM admin_roles WHERE id = $1`, [roleId])
    if (roleRes.rows.length === 0) {
      return NextResponse.json({ error: 'Vai trò không tồn tại' }, { status: 404 })
    }

    const { rows } = await pool.query(
      `INSERT INTO user_role_assignments (user_id, role_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW()
       RETURNING *`,
      [userId, roleId, guard.user.email],
    )
    return NextResponse.json({ assignment: rows[0] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
