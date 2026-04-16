import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getPayloadForApi } from './payload'
import { getDbPool } from './db-pool'
import { ADMIN_EMAIL, type PermissionKey } from './permissions'

export interface AuthorizedUser {
  id: string | number
  email: string
  role?: string
  displayName?: string
  permissions: Set<PermissionKey>
  isOwner: boolean
  roleName: string | null
}

/**
 * Fetch the authenticated user + resolved permission set.
 * Owner (ADMIN_EMAIL) bypasses role assignment — always has all perms.
 * Other users with role === 'admin' also bypass (legacy full-admin).
 * Sub-admins (users with assigned role but role !== 'admin') get role's perm set.
 */
export async function getAuthorizedUser(req: NextRequest): Promise<AuthorizedUser | null> {
  const payload = await getPayloadForApi()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return null

  const isOwner = user.email === ADMIN_EMAIL
  const isLegacyAdmin = user.role === 'admin'

  // Owner + legacy admin → all permissions
  if (isOwner || isLegacyAdmin) {
    const { ALL_PERMISSIONS } = await import('./permissions')
    return {
      id: user.id,
      email: user.email || '',
      role: user.role,
      displayName: (user as { displayName?: string }).displayName,
      permissions: new Set(ALL_PERMISSIONS),
      isOwner,
      roleName: isOwner ? 'owner' : 'admin',
    }
  }

  // Sub-admin path: look up assignment
  try {
    const pool = getDbPool()
    const { rows } = await pool.query(
      `SELECT r.name, r.permissions
       FROM user_role_assignments a
       JOIN admin_roles r ON r.id = a.role_id
       WHERE a.user_id = $1
       LIMIT 1`,
      [user.id],
    )
    if (rows.length === 0) {
      return {
        id: user.id,
        email: user.email || '',
        role: user.role,
        displayName: (user as { displayName?: string }).displayName,
        permissions: new Set(),
        isOwner: false,
        roleName: null,
      }
    }
    const perms: string[] = rows[0].permissions || []
    return {
      id: user.id,
      email: user.email || '',
      role: user.role,
      displayName: (user as { displayName?: string }).displayName,
      permissions: new Set(perms as PermissionKey[]),
      isOwner: false,
      roleName: rows[0].name as string,
    }
  } catch {
    return {
      id: user.id,
      email: user.email || '',
      role: user.role,
      permissions: new Set(),
      isOwner: false,
      roleName: null,
    }
  }
}

export function hasPermission(user: AuthorizedUser | null, key: PermissionKey): boolean {
  if (!user) return false
  return user.permissions.has(key)
}

/** API-route guard: returns NextResponse 401/403 or null if allowed. */
export async function requirePermission(
  req: NextRequest,
  key: PermissionKey,
): Promise<{ user: AuthorizedUser } | NextResponse> {
  const user = await getAuthorizedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user, key)) {
    return NextResponse.json({ error: 'Forbidden: missing permission ' + key }, { status: 403 })
  }
  return { user }
}

/** Legacy shim: any sub-admin with at least 1 permission, or full admin. */
export async function requireAnyAdmin(req: NextRequest): Promise<AuthorizedUser | null> {
  const user = await getAuthorizedUser(req)
  if (!user) return null
  if (user.isOwner || user.role === 'admin') return user
  if (user.permissions.size > 0) return user
  return null
}
