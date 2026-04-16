'use client'

import { useEffect, useRef } from 'react'

const POLL_INTERVAL = 120_000 // 2 minutes — server memoizes 30s so shorter polling just wastes RTT

/**
 * Fetches site content from the database and writes to localStorage.
 * Polls every 15s so customer browsers see admin changes in near-real-time.
 * Only updates localStorage (triggering StorageEvent) when data actually changed.
 */
export default function SiteContentSync() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function sync() {
      if (cancelled) return
      try {
        const res = await fetch('/api/site-content', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()

        if (data.settings && typeof data.settings === 'object') {
          const current = localStorage.getItem('admin_site_settings')
          const incoming = JSON.stringify(data.settings)
          if (current !== incoming) {
            localStorage.setItem('admin_site_settings', incoming)
            window.dispatchEvent(new StorageEvent('storage', { key: 'admin_site_settings' }))
          }
        }

        if (data.categoryDescriptions && typeof data.categoryDescriptions === 'object') {
          const current = localStorage.getItem('admin_category_descriptions')
          const incoming = JSON.stringify(data.categoryDescriptions)
          if (current !== incoming) {
            localStorage.setItem('admin_category_descriptions', incoming)
            window.dispatchEvent(new StorageEvent('storage', { key: 'admin_category_descriptions' }))
          }
        }
      } catch {
        // API unavailable — localStorage values remain as fallback
      }
    }

    // Fetch immediately on mount
    sync()

    // Poll every 15s — pauses when tab is hidden to save resources
    function startPolling() {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(sync, POLL_INTERVAL)
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        sync() // Fetch immediately when tab becomes visible
        startPolling()
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return null
}
