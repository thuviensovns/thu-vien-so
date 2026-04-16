import type { NextRequest } from 'next/server'

/** Extract best-effort client IP from a NextRequest.
 *  Priority: x-forwarded-for (first entry) → x-real-ip → cf-connecting-ip → 'unknown'.
 */
export function getClientIp(req: NextRequest | Request): string {
  const h = (req as NextRequest).headers
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xri = h.get('x-real-ip')
  if (xri) return xri.trim()
  const cf = h.get('cf-connecting-ip')
  if (cf) return cf.trim()
  return 'unknown'
}

export function getUserAgent(req: NextRequest | Request): string {
  const ua = (req as NextRequest).headers.get('user-agent') || ''
  return ua.slice(0, 500)
}
