import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db-pool'
import { requirePermission } from '@/lib/authz'
import { logAdminActivity } from '@/lib/log-activity'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission(req, 'automations.edit')
  if (guard instanceof NextResponse) return guard
  try {
    const { id } = await ctx.params
    let body: { name?: string; config?: Record<string, unknown>; enabled?: boolean }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const pool = getDbPool()
    await pool.query(
      `UPDATE automations
       SET name = COALESCE($1, name),
           config = COALESCE($2::jsonb, config),
           enabled = COALESCE($3, enabled),
           updated_at = NOW()
       WHERE id = $4`,
      [
        body.name || null,
        body.config !== undefined ? JSON.stringify(body.config) : null,
        typeof body.enabled === 'boolean' ? body.enabled : null,
        Number(id),
      ],
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission(req, 'automations.edit')
  if (guard instanceof NextResponse) return guard
  const { user } = guard
  try {
    const { id } = await ctx.params
    const pool = getDbPool()
    await pool.query(`DELETE FROM automations WHERE id = $1`, [Number(id)])
    await logAdminActivity(req, {
      type: 'automation',
      action: 'Xóa automation',
      detail: `id=${id}`,
      adminEmail: user.email || 'admin',
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
