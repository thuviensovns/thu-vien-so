import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { ensureTablesExist } from '@/lib/db-migrate'
import { requirePermission } from '@/lib/authz'
import { isValidPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'roles.view')
  if (guard instanceof NextResponse) return guard
  try {
    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.description, r.permissions, r.is_system, r.created_at, r.updated_at,
              COALESCE(a.cnt, 0)::int AS assigned_count
       FROM admin_roles r
       LEFT JOIN (
         SELECT role_id, COUNT(*) AS cnt FROM user_role_assignments GROUP BY role_id
       ) a ON a.role_id = r.id
       ORDER BY r.is_system DESC, r.name ASC`,
    )
    return NextResponse.json({ docs: rows })
  } catch (err) {
    console.error('[admin/roles] GET error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, 'roles.edit')
  if (guard instanceof NextResponse) return guard
  try {
    const body = await req.json()
    const name = String(body?.name || '').trim()
    const description = String(body?.description || '').trim()
    const permissions: string[] = Array.isArray(body?.permissions) ? body.permissions : []
    if (!name) return NextResponse.json({ error: 'Thiếu tên vai trò' }, { status: 400 })
    if (name.length > 100) return NextResponse.json({ error: 'Tên quá dài' }, { status: 400 })

    const validPerms = permissions.filter((p) => typeof p === 'string' && isValidPermission(p))

    await ensureTablesExist()
    const pool = getDbPool()
    const { rows } = await pool.query(
      `INSERT INTO admin_roles (name, description, permissions, is_system)
       VALUES ($1, $2, $3, false)
       RETURNING *`,
      [name, description || null, validPerms],
    )
    return NextResponse.json({ doc: rows[0] })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return NextResponse.json({ error: 'Tên vai trò đã tồn tại' }, { status: 409 })
    }
    console.error('[admin/roles] POST error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
