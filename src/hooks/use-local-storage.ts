'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook chung cho việc đọc/ghi localStorage, tự sync state.
 * Thay thế các pattern lặp lại khắp dự án.
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(defaultValue)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) {
        setState(JSON.parse(stored))
      }
    } catch {}
  }, [key])

  // Save to localStorage whenever state changes
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [key])

  return [state, setValue]
}
