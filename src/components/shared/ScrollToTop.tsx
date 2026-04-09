'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/** Scrolls to top on route change (pathname only, not search params) */
export function ScrollToTop() {
  const pathname = usePathname()
  const isFirst = useRef(true)

  useEffect(() => {
    // Skip the initial mount
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}
