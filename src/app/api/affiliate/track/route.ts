import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizedUser } from '@/lib/authz'
import { recordReferral, getAffiliateConfig } from '@/lib/affiliate'

/** POST: Link the current (just-registered) user to a referrer by ref_code.
 *  Called client-side immediately after successful registration + login.
 *  Silently no-ops if already linked, invalid code, or feature disabled. */
export async function POST(req: NextRequest) {
  const user = await getAuthorizedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const cfg = await getAffiliateConfig()
    if (!cfg.enabled) return NextResponse.json({ tracked: false, reason: 'disabled' })

    let body: { ref_code?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const code = (body.ref_code || '').trim().toUpperCase()
    if (!code) return NextResponse.json({ tracked: false, reason: 'no_code' })

    const ok = await recordReferral(Number(user.id), code)
    return NextResponse.json({ tracked: ok })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
