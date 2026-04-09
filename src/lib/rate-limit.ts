/**
 * In-memory rate limiting utility.
 * Extracted from middleware for testability and reuse.
 */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function isRateLimited(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > limit
}

export function cleanupStaleEntries(): void {
  const now = Date.now()
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap) {
      if (now > value.resetAt) rateLimitMap.delete(key)
    }
  }
}

/** Reset all entries — used in tests */
export function resetRateLimits(): void {
  rateLimitMap.clear()
}

/** Get current map size — used in tests */
export function getRateLimitMapSize(): number {
  return rateLimitMap.size
}
