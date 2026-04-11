/**
 * Admin Security Utilities — session tracking, login history, system health.
 * All data stored in localStorage.
 */

export interface AdminSession {
  id: string
  adminEmail: string
  loginAt: string
  lastActiveAt: string
  userAgent: string
  active: boolean
}

export interface LoginRecord {
  id: string
  email: string
  success: boolean
  timestamp: string
  userAgent: string
  reason?: string
}

export interface SystemHealth {
  apiStatus: 'online' | 'offline' | 'degraded'
  dbStatus: 'online' | 'offline' | 'unknown'
  responseTimeMs: number
  lastChecked: string
  storageUsed: string
  storagePercent: number
}

// --- Session Management ---

const SESSIONS_KEY = 'admin_sessions'
const MAX_SESSIONS = 50

function rand4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8)
  }
  return Math.random().toString(36).slice(2, 6)
}

export function recordSession(email: string): string {
  const id = `sess-${Date.now()}-${rand4()}`
  const session: AdminSession = {
    id,
    adminEmail: email,
    loginAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    active: true,
  }
  try {
    const sessions: AdminSession[] = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
    sessions.unshift(session)
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
    sessionStorage.setItem('current_session_id', id)
  } catch {}
  return id
}

export function updateSessionActivity(sessionId: string): void {
  try {
    const sessions: AdminSession[] = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
    const session = sessions.find((x) => x.id === sessionId)
    if (session) {
      session.lastActiveAt = new Date().toISOString()
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
    }
  } catch {}
}

export function getActiveSessions(): AdminSession[] {
  try {
    const sessions: AdminSession[] = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    return sessions
      .filter((s) => s.active && s.lastActiveAt >= thirtyMinAgo)
      .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
  } catch {
    return []
  }
}

export function getCurrentSessionId(): string | null {
  try {
    return sessionStorage.getItem('current_session_id')
  } catch {
    return null
  }
}

// --- Login History ---

const LOGIN_KEY = 'admin_login_history'
const MAX_LOGINS = 100

export function recordLogin(email: string, success: boolean, reason?: string): void {
  try {
    const record: LoginRecord = {
      id: `login-${Date.now()}-${rand4()}`,
      email,
      success,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      ...(reason ? { reason } : {}),
    }
    const history: LoginRecord[] = JSON.parse(localStorage.getItem(LOGIN_KEY) || '[]')
    history.unshift(record)
    localStorage.setItem(LOGIN_KEY, JSON.stringify(history.slice(0, MAX_LOGINS)))
  } catch {}
}

export function getLoginHistory(): LoginRecord[] {
  try {
    return JSON.parse(localStorage.getItem(LOGIN_KEY) || '[]')
  } catch {
    return []
  }
}

export function getFailedLoginsLast24h(): number {
  try {
    const history = getLoginHistory()
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    return history.filter((r) => !r.success && r.timestamp >= dayAgo).length
  } catch {
    return 0
  }
}

// --- System Health ---

export async function checkSystemHealth(): Promise<SystemHealth> {
  const start = Date.now()
  let apiStatus: SystemHealth['apiStatus'] = 'offline'
  let dbStatus: SystemHealth['dbStatus'] = 'unknown'
  let responseTimeMs = -1

  // Use the dedicated /api/ping endpoint — single SELECT 1 against the shared
  // pg pool, no Payload boot. The resulting latency is a realistic view of
  // Next route overhead + DB round-trip.
  try {
    const res = await fetch('/api/ping', { cache: 'no-store' })
    responseTimeMs = Date.now() - start
    if (res.ok) {
      apiStatus = responseTimeMs < 500 ? 'online' : 'degraded'
      dbStatus = 'online'
    } else {
      apiStatus = 'degraded'
      dbStatus = 'offline'
    }
  } catch {
    apiStatus = 'offline'
    dbStatus = 'offline'
    responseTimeMs = -1
  }

  // Estimate localStorage usage
  let totalBytes = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        totalBytes += key.length * 2 + (localStorage.getItem(key)?.length ?? 0) * 2
      }
    }
  } catch {}

  const mb = totalBytes / (1024 * 1024)
  const maxMb = 5
  const storageUsed = mb < 0.01 ? '< 0.01 MB' : `${mb.toFixed(2)} MB`
  const storagePercent = Math.round((mb / maxMb) * 100)

  return {
    apiStatus,
    dbStatus,
    responseTimeMs,
    lastChecked: new Date().toISOString(),
    storageUsed,
    storagePercent,
  }
}
