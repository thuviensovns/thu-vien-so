/**
 * Input sanitization and validation helpers for API routes.
 */

/** Sanitize a string: trim, truncate, strip control characters */
export function sanitizeString(input: unknown, maxLen = 200): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim().slice(0, maxLen)
  // Strip null bytes and control chars (except newlines/tabs)
  return trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

/** Validate that a value is a safe ID (string or positive number) */
export function isValidId(id: unknown): id is string | number {
  if (typeof id === 'number' && Number.isFinite(id) && id > 0) return true
  if (typeof id === 'string' && id.length > 0 && id.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(id)) return true
  return false
}

/** Validate that a value is a valid monetary amount */
export function isValidAmount(amount: unknown, min = 0, max = 1e9): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount >= min && amount <= max
}

/** Check if a string contains injection characters */
export function hasInjectionChars(input: string): boolean {
  return /[<>"';]/.test(input)
}
