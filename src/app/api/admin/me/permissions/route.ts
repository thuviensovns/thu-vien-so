import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizedUser } from '@/lib/authz'

export async function GET(req: NextRequest) {
  const user = await getAuthorizedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    email: user.email,
    role: user.role,
    roleName: user.roleName,
    isOwner: user.isOwner,
    permissions: Array.from(user.permissions),
  })
}
