'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook polling thông minh:
 * - Pause khi tab bị ẩn (document.hidden) để tiết kiệm tài nguyên
 * - Fetch ngay khi tab được focus lại
 * - Tự cleanup interval khi unmount
 * - Hỗ trợ enabled flag để điều kiện bật/tắt
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let intervalId: ReturnType<typeof setInterval> | null = null

    function startPolling() {
      if (intervalId) return
      intervalId = setInterval(() => callbackRef.current(), intervalMs)
    }

    function stopPolling() {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling()
      } else {
        // Fetch ngay khi tab active lại
        callbackRef.current()
        startPolling()
      }
    }

    // Fetch lần đầu + start polling
    callbackRef.current()
    startPolling()

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [intervalMs, enabled])
}
