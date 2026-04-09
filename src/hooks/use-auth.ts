'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface AuthUser {
  id: string
  email: string
  displayName?: string
  role?: 'admin' | 'customer'
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (data: { displayName: string; email: string; password: string }) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => {},
  refreshUser: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// --- Auth state ---

export function useAuthState(): AuthContextType {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user || null)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        const loggedInUser = data.user || null
        setUser(loggedInUser)
        return { ok: true }
      }
      // Parse error
      let errMsg = 'Đăng nhập thất bại'
      try {
        const parsed = await res.json()
        errMsg = parsed.message || parsed.errors?.[0]?.message || errMsg
      } catch {}

      if (res.status === 401) {
        return { ok: false, error: 'Email hoặc mật khẩu không đúng' }
      }
      return { ok: false, error: errMsg }
    } catch {
      return { ok: false, error: 'Không thể kết nối đến server. Vui lòng thử lại.' }
    }
  }, [])

  const register = useCallback(async (data: { displayName: string; email: string; password: string }) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })
      if (res.ok) {
        return { ok: true }
      }
      let errMsg = 'Đăng ký thất bại'
      try {
        const parsed = await res.json()
        errMsg = parsed.message || parsed.errors?.[0]?.message || errMsg
      } catch {}

      return { ok: false, error: errMsg }
    } catch {
      return { ok: false, error: 'Không thể kết nối đến server. Vui lòng thử lại.' }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } catch {}
    setUser(null)
  }, [])

  return { user, isLoading, login, register, logout, refreshUser }
}
