import crypto from 'crypto'

/**
 * Payload's JWT payload shape (HS256). We only rely on `id`; the rest is
 * informational and shape may drift between Payload versions.
 */
export interface VerifiedPayloadJwt {
  id: number
  collection?: string
  email?: string
  exp?: number
  iat?: number
}

/**
 * Verify a `payload-token` cookie without touching Payload — HMAC-SHA256 with
 * PAYLOAD_SECRET, constant-time signature comparison, expiry check.
 *
 * This is the hot-path alternative to `payload.auth({ headers })`, which
 * pulls in the entire Payload runtime (slow on cold serverless). We only
 * trust the token for reading user.id; anything that needs the full user
 * row must re-fetch from the DB.
 *
 * Returns null on any mismatch so the caller can fall back to `payload.auth`.
 */
export function verifyPayloadJwt(token: string, secret: string): VerifiedPayloadJwt | null {
  if (!token || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h64, p64, s64] = parts

  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${h64}.${p64}`)
      .digest('base64url')
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(s64, 'utf8')
    if (a.length !== b.length) return null
    if (!crypto.timingSafeEqual(a, b)) return null

    const raw = Buffer.from(p64, 'base64url').toString('utf8')
    const payload = JSON.parse(raw) as Record<string, unknown>

    // Expiry
    const exp = typeof payload.exp === 'number' ? payload.exp : undefined
    if (exp && Date.now() / 1000 > exp) return null

    // ID — accept number or numeric string (defensive across Payload versions)
    const rawId = payload.id
    const id = typeof rawId === 'number' ? rawId : Number(rawId)
    if (!Number.isFinite(id) || id <= 0) return null

    // Collection — some Payload versions omit this, or use a different key.
    // Only reject if it's explicitly set to a non-users collection.
    const collection = typeof payload.collection === 'string' ? payload.collection : undefined
    if (collection && collection !== 'users') return null

    return {
      id,
      collection,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      exp,
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    }
  } catch {
    return null
  }
}
