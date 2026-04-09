import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isRateLimited, cleanupStaleEntries, resetRateLimits, getRateLimitMapSize } from '../rate-limit'

beforeEach(() => {
  resetRateLimits()
})

describe('isRateLimited', () => {
  it('allows first request', () => {
    expect(isRateLimited('ip1', 5)).toBe(false)
  })

  it('allows requests within limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited('ip1', 5)).toBe(false)
    }
  })

  it('blocks requests exceeding limit', () => {
    for (let i = 0; i < 5; i++) {
      isRateLimited('ip1', 5)
    }
    expect(isRateLimited('ip1', 5)).toBe(true)
  })

  it('resets after window expires', () => {
    vi.useFakeTimers()
    for (let i = 0; i < 5; i++) {
      isRateLimited('ip1', 5, 1000)
    }
    expect(isRateLimited('ip1', 5, 1000)).toBe(true)

    vi.advanceTimersByTime(1001)
    expect(isRateLimited('ip1', 5, 1000)).toBe(false)
    vi.useRealTimers()
  })

  it('tracks different keys independently', () => {
    for (let i = 0; i < 5; i++) {
      isRateLimited('ip1', 5)
    }
    expect(isRateLimited('ip1', 5)).toBe(true)
    expect(isRateLimited('ip2', 5)).toBe(false)
  })
})

describe('cleanupStaleEntries', () => {
  it('cleans up stale entries when map exceeds 1000', () => {
    vi.useFakeTimers()
    // Fill map with 1001 entries that are already expired
    for (let i = 0; i < 1001; i++) {
      isRateLimited(`ip${i}`, 1, 100)
    }
    expect(getRateLimitMapSize()).toBe(1001)

    vi.advanceTimersByTime(200) // expire all entries
    cleanupStaleEntries()
    expect(getRateLimitMapSize()).toBe(0)
    vi.useRealTimers()
  })

  it('does not clean up when map is under 1000', () => {
    vi.useFakeTimers()
    for (let i = 0; i < 500; i++) {
      isRateLimited(`ip${i}`, 1, 100)
    }
    vi.advanceTimersByTime(200)
    cleanupStaleEntries()
    expect(getRateLimitMapSize()).toBe(500) // not cleaned because < 1000
    vi.useRealTimers()
  })
})
