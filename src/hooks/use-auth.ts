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

// --- Demo/offline helpers ---

/** Check if error message indicates server/Payload is down */
function isServerError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes('payload') ||
    lower.includes('initializing') ||
    lower.includes('econnrefused') ||
    lower.includes('database') ||
    lower.includes('internal server')
  )
}

function getDemoUsers(): AuthUser[] {
  try {
    const raw = localStorage.getItem('demo_users')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveDemoUsers(users: AuthUser[]) {
  try {
    localStorage.setItem('demo_users', JSON.stringify(users))
  } catch {}
}

function getDemoPasswords(): Record<string, string> {
  try {
    const raw = localStorage.getItem('demo_passwords')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveDemoPasswords(map: Record<string, string>) {
  try {
    localStorage.setItem('demo_passwords', JSON.stringify(map))
  } catch {}
}

function setDemoSession(user: AuthUser | null) {
  try {
    if (user) {
      localStorage.setItem('demo_session', JSON.stringify(user))
    } else {
      localStorage.removeItem('demo_session')
    }
  } catch {}
}

function getDemoSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem('demo_session')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
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
        if (data.user) {
          setUser(data.user)
          setIsLoading(false)
          return
        }
      }
    } catch {
      // API unavailable
    }
    // Fallback to demo session
    const demo = getDemoSession()
    setUser(demo)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    // Try real API first
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
        // Also save demo session as backup (in case cookie expires, user stays logged in for UI)
        if (loggedInUser) setDemoSession(loggedInUser)
        return { ok: true }
      }
      // Try to parse error body
      let errMsg = ''
      try {
        const text = await res.text()
        try {
          const parsed = JSON.parse(text)
          errMsg = parsed.message || parsed.errors?.[0]?.message || ''
        } catch {
          // Response is not JSON (could be HTML error page)
          if (text.toLowerCase().includes('payload') || text.toLowerCase().includes('error')) {
            // Server error, fall through to demo
          }
        }
      } catch {}

      // If it's a real auth error (e.g. 401 wrong password) and NOT a server issue
      if (res.status < 500 && errMsg && !isServerError(errMsg)) {
        return { ok: false, error: errMsg }
      }
      // Otherwise fall through to demo login
    } catch {
      // Network error — fall through to demo login
    }

    // Demo fallback: registered demo users
    const users = getDemoUsers()
    const passwords = getDemoPasswords()
    const found = users.find((u) => u.email === email)
    if (found && passwords[email] === password) {
      setUser(found)
      setDemoSession(found)
      return { ok: true }
    }

    if (found) {
      return { ok: false, error: 'Mật khẩu không đúng' }
    }
    return { ok: false, error: 'Tài khoản không tồn tại. Vui lòng đăng ký.' }
  }, [])

  const register = useCallback(async (data: { displayName: string; email: string; password: string }) => {
    // Try real API first
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
      let errMsg = ''
      try {
        const text = await res.text()
        try {
          const parsed = JSON.parse(text)
          errMsg = parsed.message || parsed.errors?.[0]?.message || ''
        } catch {}
      } catch {}

      if (res.status < 500 && errMsg && !isServerError(errMsg)) {
        return { ok: false, error: errMsg }
      }
    } catch {
      // Network error — fall through to demo
    }

    // Demo fallback: check duplicates
    const users = getDemoUsers()
    if (users.some((u) => u.email === data.email)) {
      return { ok: false, error: 'Email đã được sử dụng' }
    }

    // Save new demo user (include extra fields for admin-helpers DemoUser compatibility)
    const newUser: AuthUser & { createdAt: string; banned: boolean; balance: number } = {
      id: `user-${Date.now()}`,
      email: data.email,
      displayName: data.displayName,
      role: 'customer',
      createdAt: new Date().toISOString(),
      banned: false,
      balance: 0,
    }
    saveDemoUsers([...users, newUser as AuthUser])
    const passwords = getDemoPasswords()
    passwords[data.email] = data.password
    saveDemoPasswords(passwords)

    return { ok: true }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } catch {}
    setUser(null)
    setDemoSession(null)
  }, [])

  return { user, isLoading, login, register, logout, refreshUser }
}
