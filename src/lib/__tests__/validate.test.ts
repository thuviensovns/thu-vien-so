import { describe, it, expect } from 'vitest'
import { sanitizeString, isValidId, isValidAmount, hasInjectionChars } from '../validate'

describe('sanitizeString', () => {
  it('returns null for non-string input', () => {
    expect(sanitizeString(123)).toBeNull()
    expect(sanitizeString(null)).toBeNull()
    expect(sanitizeString(undefined)).toBeNull()
  })

  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })

  it('truncates to maxLen', () => {
    expect(sanitizeString('abcdefg', 3)).toBe('abc')
  })

  it('strips null bytes and control characters', () => {
    expect(sanitizeString('hello\x00world')).toBe('helloworld')
    expect(sanitizeString('test\x01\x02data')).toBe('testdata')
  })

  it('preserves newlines and tabs', () => {
    expect(sanitizeString('line1\nline2')).toBe('line1\nline2')
    expect(sanitizeString('col1\tcol2')).toBe('col1\tcol2')
  })
})

describe('isValidId', () => {
  it('accepts positive numbers', () => {
    expect(isValidId(1)).toBe(true)
    expect(isValidId(42)).toBe(true)
  })

  it('rejects zero and negative numbers', () => {
    expect(isValidId(0)).toBe(false)
    expect(isValidId(-1)).toBe(false)
  })

  it('rejects NaN and Infinity', () => {
    expect(isValidId(NaN)).toBe(false)
    expect(isValidId(Infinity)).toBe(false)
  })

  it('accepts valid string IDs', () => {
    expect(isValidId('abc-123')).toBe(true)
    expect(isValidId('product_slug')).toBe(true)
  })

  it('rejects empty strings', () => {
    expect(isValidId('')).toBe(false)
  })

  it('rejects strings with special characters', () => {
    expect(isValidId('test<script>')).toBe(false)
    expect(isValidId('hello world')).toBe(false)
  })

  it('rejects strings over 100 chars', () => {
    expect(isValidId('a'.repeat(101))).toBe(false)
    expect(isValidId('a'.repeat(100))).toBe(true)
  })
})

describe('isValidAmount', () => {
  it('accepts valid amounts', () => {
    expect(isValidAmount(10000)).toBe(true)
    expect(isValidAmount(0)).toBe(true)
  })

  it('rejects non-numbers', () => {
    expect(isValidAmount('100')).toBe(false)
    expect(isValidAmount(null)).toBe(false)
  })

  it('rejects amounts below min', () => {
    expect(isValidAmount(-1, 0)).toBe(false)
    expect(isValidAmount(5000, 10000)).toBe(false)
  })

  it('rejects amounts above max', () => {
    expect(isValidAmount(2e9, 0, 1e9)).toBe(false)
  })

  it('rejects NaN and Infinity', () => {
    expect(isValidAmount(NaN)).toBe(false)
    expect(isValidAmount(Infinity)).toBe(false)
  })
})

describe('hasInjectionChars', () => {
  it('detects angle brackets', () => {
    expect(hasInjectionChars('<script>')).toBe(true)
  })

  it('detects quotes', () => {
    expect(hasInjectionChars("test'or'1=1")).toBe(true)
    expect(hasInjectionChars('test"value')).toBe(true)
  })

  it('detects semicolons', () => {
    expect(hasInjectionChars('DROP TABLE;')).toBe(true)
  })

  it('passes clean strings', () => {
    expect(hasInjectionChars('hello-world_123')).toBe(false)
    expect(hasInjectionChars('NAP1A2B3C')).toBe(false)
  })
})
