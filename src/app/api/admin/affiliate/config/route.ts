import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { getAffiliateConfig, saveAffiliateConfig, type AffiliateConfig } from '@/lib/affiliate'
import { logAdminActivity } from '@/lib/log-activity'

/** GET: Current affiliate config. */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, 'affiliate.view')
  if (guard instanceof NextResponse) return guard
  const cfg = await getAffiliateConfig()
  return NextResponse.json(cfg)
}

/** PUT: Save affiliate config. */
export async function PUT(req: NextRequest) {
  const guard = await requirePermission(req, 'affiliate.config')
  if (guard instanceof NextResponse) return guard
  const { user } = guard
  try {
    let body: Partial<AffiliateConfig>
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const cfg: AffiliateConfig = {
      enabled: !!body.enabled,
      commissionPercent: Math.max(0, Math.min(50, Number(body.commissionPercent) || 0)),
      minWithdrawal: Math.max(0, Number(body.minWithdrawal) || 0),
      creditSources: Array.isArray(body.creditSources) && body.creditSources.length > 0
        ? (body.creditSources.filter((s) => s === 'topup' || s === 'order') as ('topup' | 'order')[])
        : ['topup'],
    }
    await saveAffiliateConfig(cfg, user.email || 'admin')
    await logAdminActivity(req, {
      type: 'affiliate',
      action: 'Cập nhật cấu hình affiliate',
      detail: `enabled=${cfg.enabled} %=${cfg.commissionPercent} min=${cfg.minWithdrawal}`,
      adminEmail: user.email || 'admin',
    })
    return NextResponse.json({ success: true, config: cfg })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
