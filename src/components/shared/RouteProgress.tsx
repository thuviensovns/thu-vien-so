'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Lightweight NProgress-style route loading bar.
 * Shows a thin animated bar at the top of the page during route transitions.
 */
export function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevUrl = useRef('')

  const startProgress = useCallback(() => {
    setVisible(true)
    setProgress(15)

    // Incrementally increase progress to simulate loading
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 90
        }
        // Slow down as we get higher
        const increment = prev < 50 ? 8 : prev < 80 ? 3 : 1
        return Math.min(prev + increment, 90)
      })
    }, 150)
  }, [])

  const completeProgress = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setProgress(100)
    setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 300)
  }, [])

  // Detect route changes
  useEffect(() => {
    const currentUrl = pathname + searchParams.toString()
    if (prevUrl.current && prevUrl.current !== currentUrl) {
      completeProgress()
    }
    prevUrl.current = currentUrl
  }, [pathname, searchParams, completeProgress])

  // Intercept link clicks to start progress immediately
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return
      if (target.getAttribute('target') === '_blank') return
      if (e.metaKey || e.ctrlKey || e.shiftKey) return

      // Same page check
      const currentUrl = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '')
      if (href === currentUrl || href === pathname) return

      startProgress()
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname, searchParams, startProgress])

  if (!visible && progress === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-[2.5px] bg-gradient-to-r from-primary via-primary to-primary/60 shadow-[0_0_10px_var(--primary),0_0_5px_var(--primary)]"
        style={{
          width: `${progress}%`,
          transition: progress === 0
            ? 'none'
            : progress === 100
              ? 'width 200ms ease-out, opacity 200ms ease-out 100ms'
              : 'width 300ms ease-out',
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  )
}
