'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/** Reads `?ref=XXXX` from the URL on first load and stores it in localStorage
 *  so it survives until the user eventually registers.
 *  Mounted in the root client layout as a side-effect component. */
export default function AffiliateRefCapture() {
  const sp = useSearchParams()

  useEffect(() => {
    const ref = sp.get('ref')
    if (ref && typeof window !== 'undefined') {
      const code = ref.trim().toUpperCase().slice(0, 32)
      if (code) {
        try { localStorage.setItem('affiliate_ref', code) } catch { /* ignore */ }
      }
    }
  }, [sp])

  return null
}
