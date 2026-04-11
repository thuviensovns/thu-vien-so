import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import type { User } from '@/types/payload-types'

// Balance must never be served from cache — admin credits / bank webhook
// deposits / pay-with-balance deductions all need to be reflected on the next
// client fetch. Next.js 15 sometimes treats auth-cookie-only routes as static.
export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET: Fetch current user balance from DB */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch fresh user data to get balance
    const freshUser = await payload.findByID({ collection: 'users', id: user.id }) as User
    const balance = freshUser.balance || 0

    return NextResponse.json({ balance })
  } catch (error) {
    console.error('[Balance] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
