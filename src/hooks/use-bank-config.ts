'use client'

import { useState, useEffect } from 'react'
import { defaultBankAccount, type BankAccount } from '@/lib/config'

/** Fetch bank config from server API, falling back to defaultBankAccount */
export function useBankConfig() {
  const [bank, setBank] = useState<BankAccount>(defaultBankAccount)

  useEffect(() => {
    async function fetchBankConfig() {
      try {
        const res = await fetch('/api/bank-config')
        if (res.ok) {
          const data = await res.json()
          if (data.accountNumber) setBank(data)
        }
      } catch {}
    }
    fetchBankConfig()
  }, [])

  return bank
}
