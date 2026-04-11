'use client'

import { useEffect, useState } from 'react'

/**
 * Re-renders the consumer every `intervalMs` so relative time displays
 * ("Vừa xong", "X phút trước") stay current between data re-fetches.
 *
 * Default 30s is fine for message timestamps — "Vừa xong" → "1 phút trước"
 * lands on the next tick, and longer-running relative labels update often
 * enough that users don't perceive staleness.
 */
export function useTick(intervalMs = 30000): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return tick
}
