'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface BalanceContextType {
  balance: number
  refreshBalance: () => Promise<void>
  deductBalance: (amount: number) => boolean
  setBalance: (amount: number) => void
}

export const BalanceContext = createContext<BalanceContextType>({
  balance: 0,
  refreshBalance: async () => {},
  deductBalance: () => false,
  setBalance: () => {},
})

export function useBalance() {
  return useContext(BalanceContext)
}

export function useBalanceState(): BalanceContextType {
  const [balance, setBalanceState] = useState(0)

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/balance', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const val = Number(data.balance)
        if (!isNaN(val) && val >= 0) setBalanceState(val)
      }
    } catch {}
  }, [])

  // Fetch balance from DB on mount and when tab becomes visible
  useEffect(() => {
    refreshBalance()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshBalance()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [refreshBalance])

  const deductBalance = useCallback((amount: number): boolean => {
    if (balance < amount) return false
    setBalanceState((prev) => (prev >= amount ? prev - amount : prev))
    return true
  }, [balance])

  const setBalance = useCallback((amount: number) => {
    if (amount >= 0) setBalanceState(amount)
  }, [])

  return { balance, refreshBalance, deductBalance, setBalance }
}
