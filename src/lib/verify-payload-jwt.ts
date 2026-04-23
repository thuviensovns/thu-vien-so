import crypto from 'crypto'

/**
 * Payload's JWT payload shape (HS256). Only `id` + `collection` are mandatory
 * for our use cases; everything else is informational.
 */
export interface VerifiedPayloadJwt {
  id: number
  collection: string
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
    const payload = JSON.parse(raw) as VerifiedPayloadJwt
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    if (typeof payload.id !== 'number' || !Number.isFinite(payload.id)) return null
    if (payload.collection !== 'users') return null
    return payload
  } catch {
    return null
  }
}
