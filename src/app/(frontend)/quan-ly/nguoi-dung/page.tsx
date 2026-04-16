'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  Users, ShieldCheck, User, Mail, Trash2, AlertCircle,
  Search, Ban, CheckCircle2, Wallet, ArrowUpCircle, ArrowDownCircle, FileDown, Loader2, KeyRound, UserCog,
  Receipt, ShoppingCart, Gift,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatVND } from '@/lib/format'
import { getUserTransferCode } from '@/lib/config'
import { getDemoUsers, saveDemoUsers, logActivity, type DemoUser } from '@/lib/admin-helpers'
import { toast } from 'sonner'
import AdminPagination, { paginate } from '@/components/admin/AdminPagination'

const ITEMS_PER_PAGE = 15

interface PayloadUser {
  id: string | number
  email: string
  displayName?: string
  role?: string
  balance?: number
  createdAt?: string
}

interface TopupMatch {
  id: number
  transferCode: string | null
  bankDescription: string | null
  bankTransactionId: string | null
  amount: number
  status: string
  createdAt: string
}

interface OrderMatch {
  id: number
  orderNumber: string | null
  transferCode: string | null
  customerEmail: string | null
  customerName: string | null
  customerPhone: string | null
  note: string | null
  total: number
  status: string
  createdAt: string
}

interface SearchHit {
  id: string
  email: string
  displayName: string
  balance: number
  role: string
  matchedUserField: boolean
  topupMatches: TopupMatch[]
  orderMatches: OrderMatch[]
}

export default function UsersPage() {
  const [dbUsers, setDbUsers] = useState<DemoUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [balanceUserId, setBalanceUserId] = useState<string | null>(null)
  const [balanceAmount, setBalanceAmount] = useState('')
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [page, setPage] = useState(1)
  const [balanceProcessing, setBalanceProcessing] = useState<null | 'add' | 'deduct'>(null)
  const [roleAssignUserId, setRoleAssignUserId] = useState<string | null>(null)
  const [availableRoles, setAvailableRoles] = useState<{ id: number; name: string; description: string | null }[]>([])
  const [userAssignments, setUserAssignments] = useState<Record<string, { role_id: number; role_name: string } | null>>({})
  const [roleAssigning, setRoleAssigning] = useState(false)
  // Affiliate info per user (ref_code, referrals, earnings) — fetched in parallel
  // with the user list so admin sees who is actively referring straight from here.
  const [affiliateMap, setAffiliateMap] = useState<Record<string, {
    refCode: string; referralCount: number; totalEarned: number; autoCredited: number
  }>>({})
  // Server-side cross-table search (email / name / topup content / order content)
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchAbortRef = useRef<AbortController | null>(null)

  // Fetch real users from Payload API
  const fetchUsers = useCallback(async () => {
    try {
      // cache: 'no-store' + cache-buster so balance updates land immediately
      // after admin credits a user (Vercel prod otherwise returns stale docs)
      const res = await fetch(`/api/users?limit=500&sort=-createdAt&_t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) {
        toast.error(`Không thể tải danh sách người dùng (HTTP ${res.status})`)
        setDbUsers([])
        return
      }
      const data = await res.json()
      const users: DemoUser[] = (data.docs || []).map((u: PayloadUser) => ({
        id: String(u.id),
        email: u.email,
        displayName: u.displayName || '',
        role: (u.role as 'admin' | 'customer') || 'customer',
        balance: Number(u.balance || 0),
      }))
      setDbUsers(users)
    } catch (err) {
      console.error('[UsersPage] fetch failed:', err)
      toast.error('Lỗi kết nối API người dùng')
      setDbUsers(getDemoUsers())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Fetch affiliate accounts so admin sees ref_code + earnings per user.
  // Non-fatal if permission denied or feature off — user list still renders.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/affiliate/accounts?limit=1000', {
          credentials: 'include',
        })
        if (!res.ok) return
        const data = await res.json()
        const map: Record<string, { refCode: string; referralCount: number; totalEarned: number; autoCredited: number }> = {}
        for (const a of data.docs || []) {
          map[String(a.user_id)] = {
            refCode: a.ref_code,
            referralCount: Number(a.referral_count || 0),
            totalEarned: Number(a.total_earned || 0),
            autoCredited: Number(a.auto_credited || 0),
          }
        }
        setAffiliateMap(map)
      } catch { /* ignore */ }
    })()
  }, [])

  // Fetch all roles + all assignments for quick lookup
  useEffect(() => {
    (async () => {
      try {
        const [rolesRes, assignRes] = await Promise.all([
          fetch('/api/admin/roles', { credentials: 'include' }),
          fetch('/api/admin/roles/assignments', { credentials: 'include' }),
        ])
        if (rolesRes.ok) {
          const data = await rolesRes.json()
          setAvailableRoles((data.docs || []).map((r: { id: number; name: string; description: string | null }) => ({
            id: r.id, name: r.name, description: r.description,
          })))
        }
        if (assignRes.ok) {
          const data = await assignRes.json()
          const map: Record<string, { role_id: number; role_name: string }> = {}
          for (const a of data.docs || []) {
            map[String(a.user_id)] = { role_id: a.role_id, role_name: a.role_name }
          }
          setUserAssignments(map)
        }
      } catch { /* ignore — permission may be absent */ }
    })()
  }, [])

  async function handleAssignRole(userId: string, roleId: number | null) {
    if (roleAssigning) return
    setRoleAssigning(true)
    try {
      const res = await fetch('/api/admin/roles/assignments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: Number(userId), role_id: roleId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Lỗi gán vai trò')
        return
      }
      if (roleId === null) {
        setUserAssignments((prev) => ({ ...prev, [userId]: null }))
        toast.success('Đã gỡ vai trò')
      } else {
        const role = availableRoles.find((r) => r.id === roleId)
        setUserAssignments((prev) => ({
          ...prev,
          [userId]: { role_id: roleId, role_name: role?.name || '' },
        }))
        toast.success(`Đã gán vai trò: ${role?.name}`)
      }
      setRoleAssignUserId(null)
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setRoleAssigning(false)
    }
  }

  // Refresh on focus
  useEffect(() => {
    const refresh = () => fetchUsers()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [fetchUsers])

  const allUsers = dbUsers

  // Debounced cross-table search — fires server-side so admins can locate users
  // by transaction content (transferCode, order number, bank desc, etc.) even if
  // the user isn't in the initial 500-row batch.
  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setSearchHits(null)
      setSearchLoading(false)
      searchAbortRef.current?.abort()
      return
    }
    setSearchLoading(true)
    const handle = setTimeout(() => {
      searchAbortRef.current?.abort()
      const ac = new AbortController()
      searchAbortRef.current = ac
      fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: ac.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((data: { docs: SearchHit[] }) => {
          setSearchHits(data.docs || [])
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setSearchHits([])
        })
        .finally(() => setSearchLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [search])

  const hitsById = useMemo(() => {
    if (!searchHits) return null
    const map = new Map<string, SearchHit>()
    for (const h of searchHits) map.set(h.id, h)
    return map
  }, [searchHits])

  const filtered = useMemo(() => {
    if (!search.trim()) return allUsers
    // Server search active — merge hits with local user data so all admin
    // actions (role, balance, ban) still work via the cached users.
    if (!searchHits) return []
    const localById = new Map(allUsers.map((u) => [u.id, u]))
    return searchHits.map((h) => {
      const local = localById.get(h.id)
      return local
        ? { ...local, balance: h.balance }
        : {
            id: h.id,
            email: h.email,
            displayName: h.displayName,
            role: (h.role === 'admin' ? 'admin' : 'customer') as 'admin' | 'customer',
            balance: h.balance,
          }
    })
  }, [allUsers, search, searchHits])

  const adminCount = allUsers.filter((u) => u.role === 'admin').length
  const customerCount = allUsers.filter((u) => u.role !== 'admin').length
  const bannedCount = allUsers.filter((u) => u.banned).length

  async function handleDelete(userId: string) {
    const user = allUsers.find((u) => u.id === userId)
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error('API error')
      setDbUsers((prev) => prev.filter((u) => u.id !== userId))
      if (user) logActivity('user', 'Xóa người dùng', user.email)
      toast.success('Đã xóa người dùng')
    } catch {
      toast.error('Không thể xóa người dùng')
    }
  }

  async function handleBanToggle(userId: string) {
    const user = allUsers.find((u) => u.id === userId)
    if (!user) return
    const newBanned = !user.banned
    // Note: Payload Users collection may not have a 'banned' field — update locally for now
    setDbUsers((prev) => prev.map((u) => u.id === userId ? { ...u, banned: newBanned } : u))
    logActivity('user', newBanned ? 'Khóa tài khoản' : 'Mở khóa tài khoản', user.email)
    toast.success(newBanned ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản')
  }

  async function handleRoleChange(userId: string) {
    const user = allUsers.find((u) => u.id === userId)
    if (!user) return
    const newRole = user.role === 'admin' ? 'customer' : 'admin'
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error('API error')
      setDbUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole as 'admin' | 'customer' } : u))
      logActivity('user', `Đổi quyền → ${newRole}`, user.email)
      toast.success(`Đã đổi quyền thành ${newRole}`)
    } catch {
      toast.error('Không thể đổi quyền người dùng')
    }
  }

  async function handleAddBalance(userId: string) {
    if (balanceProcessing) return
    const amount = parseInt(balanceAmount)
    if (isNaN(amount) || amount < 1000) {
      toast.error('Số tiền tối thiểu 1.000₫')
      return
    }
    const user = allUsers.find((u) => u.id === userId)
    if (!user) return

    setBalanceProcessing('add')
    try {
      const res = await fetch('/api/admin/topups', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, amount }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Lỗi cộng tiền')
        return
      }
      const commission = data.commission as {
        credited?: boolean; amount?: number; reason?: string; referrerEmail?: string
      } | undefined
      const baseDesc = `Số dư mới: ${formatVND(data.newBalance)}`
      const commissionDesc = commission?.credited && commission.amount
        ? ` · Hoa hồng ${formatVND(commission.amount)} → ${commission.referrerEmail || `referrer #${(commission as { referrerId?: number }).referrerId || '?'}`}`
        : commission?.reason && commission.reason !== 'user_not_referred'
          ? ` · Hoa hồng không cộng (${commission.reason})`
          : ''
      toast.success(`Đã cộng ${formatVND(amount)} cho ${user.displayName || user.email}`, {
        description: baseDesc + commissionDesc,
      })
      // Update balance locally
      setDbUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, balance: data.newBalance } : u
      ))
      // Re-fetch from server so any concurrent change is reflected too
      fetchUsers()
      // Refresh affiliateMap so referrer's new totals appear on their card
      if (commission?.credited) {
        fetch('/api/admin/affiliate/accounts?limit=1000', { credentials: 'include' })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => {
            if (!d?.docs) return
            const map: typeof affiliateMap = {}
            for (const a of d.docs) {
              map[String(a.user_id)] = {
                refCode: a.ref_code,
                referralCount: Number(a.referral_count || 0),
                totalEarned: Number(a.total_earned || 0),
                autoCredited: Number(a.auto_credited || 0),
              }
            }
            setAffiliateMap(map)
          })
          .catch(() => {})
      }
      setBalanceUserId(null)
      setBalanceAmount('')
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setBalanceProcessing(null)
    }
  }

  async function handleDeductBalance(userId: string) {
    if (balanceProcessing) return
    const amount = parseInt(balanceAmount)
    if (isNaN(amount) || amount < 1000) {
      toast.error('Số tiền tối thiểu 1.000₫')
      return
    }
    const user = allUsers.find((u) => u.id === userId)
    if (!user) return

    if (amount > (user.balance || 0)) {
      toast.error(`Số dư không đủ để trừ. Hiện có: ${formatVND(user.balance || 0)}`)
      return
    }

    setBalanceProcessing('deduct')
    try {
      const res = await fetch('/api/admin/topups/deduct', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, amount }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Lỗi trừ tiền')
        return
      }
      toast.success(`Đã trừ ${formatVND(amount)} của ${user.displayName || user.email}`, {
        description: `Số dư mới: ${formatVND(data.newBalance)}`,
      })
      setDbUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, balance: data.newBalance } : u
      ))
      fetchUsers()
      setBalanceUserId(null)
      setBalanceAmount('')
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setBalanceProcessing(null)
    }
  }

  async function handleResetPassword(userId: string) {
    const pw = newPassword.trim()
    if (pw.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    const user = allUsers.find((u) => u.id === userId)
    if (!user) return

    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword: pw }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Lỗi đặt lại mật khẩu')
        return
      }
      toast.success(`Đã đặt lại mật khẩu cho ${user.displayName || user.email}`)
    } catch {
      toast.error('Lỗi kết nối')
    }
    setResetPwUserId(null)
    setNewPassword('')
  }

  function handleExport() {
    const csv = [
      'ID,Email,Tên,Quyền,Trạng thái,Mã CK',
      ...allUsers.map((u) =>
        `${u.id},${u.email},${u.displayName || ''},${u.role || 'customer'},${u.banned ? 'banned' : 'active'},${getUserTransferCode(u.id)}`
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Đã xuất file CSV')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Quản lý người dùng
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allUsers.length} người dùng ({adminCount} admin, {customerCount} customer)
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
          Xuất CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Tổng người dùng</p>
            <p className="text-lg font-bold text-blue-500">{allUsers.length}</p>
          </CardContent>
        </Card>
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Admin</p>
            <p className="text-lg font-bold text-warning">{adminCount}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Bị khóa</p>
            <p className="text-lg font-bold text-destructive">{bannedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Tìm theo email / tên / mã CK / mã đơn / nội dung chuyển khoản..."
          className="pl-9 pr-9 bg-muted/50"
        />
        {searchLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>
      {search.trim().length >= 2 && searchHits && (
        <p className="text-xs text-muted-foreground -mt-4">
          {searchHits.length} kết quả khớp · bao gồm cả giao dịch nạp / đơn hàng
        </p>
      )}

      {/* Users list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Đang tải danh sách người dùng...</span>
        </div>
      ) : (() => {
        const { paged: pagedUsers, totalPages } = paginate(filtered, page, ITEMS_PER_PAGE)
        return (<>
      <div className="space-y-2">
        {pagedUsers.map((user) => {
          const isBuiltInAdmin = false
          const isAdmin = user.role === 'admin'
          const isBanned = 'banned' in user && user.banned

          return (
            <Card key={user.id} className={`border-border bg-card ${isBanned ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    isAdmin ? 'bg-warning/10' : isBanned ? 'bg-destructive/10' : 'bg-muted/50'
                  }`}>
                    {isAdmin ? (
                      <ShieldCheck className="h-5 w-5 text-warning" />
                    ) : isBanned ? (
                      <Ban className="h-5 w-5 text-destructive" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">
                        {user.displayName || 'Chưa đặt tên'}
                      </p>
                      {isAdmin && (
                        <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px] px-1.5 py-0">
                          ADMIN
                        </Badge>
                      )}
                      {isBanned && (
                        <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 py-0">
                          KHÓA
                        </Badge>
                      )}
                      {isBuiltInAdmin && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Built-in
                        </Badge>
                      )}
                      {userAssignments[user.id] && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">
                          <UserCog className="h-2.5 w-2.5 mr-0.5" />
                          {userAssignments[user.id]?.role_name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        {user.email}
                      </span>
                      {typeof user.balance === 'number' && (
                        <span className="flex items-center gap-1 text-success font-medium shrink-0">
                          <Wallet className="h-3 w-3" />
                          {formatVND(user.balance)}
                        </span>
                      )}
                      {user.role !== 'admin' && (
                        <span className="font-mono text-[10px] text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded shrink-0">
                          {getUserTransferCode(user.id)}
                        </span>
                      )}
                      {affiliateMap[user.id] && (
                        <span
                          className="flex items-center gap-1 font-mono text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded shrink-0"
                          title={`Mã giới thiệu · ${affiliateMap[user.id].referralCount} lượt · tổng kiếm ${formatVND(affiliateMap[user.id].totalEarned)} · đã vào ví ${formatVND(affiliateMap[user.id].autoCredited)}`}
                        >
                          <Gift className="h-3 w-3" />
                          {affiliateMap[user.id].refCode}
                          {affiliateMap[user.id].referralCount > 0 && (
                            <span className="ml-0.5">({affiliateMap[user.id].referralCount})</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!isBuiltInAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Balance adjust button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-success hover:text-success"
                        onClick={() => setBalanceUserId(balanceUserId === user.id ? null : user.id)}
                        title="Cộng/Trừ tiền"
                      >
                        <ArrowUpCircle className="h-4 w-4" />
                      </Button>
                      {/* Reset password */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:text-primary"
                        onClick={() => { setResetPwUserId(resetPwUserId === user.id ? null : user.id); setBalanceUserId(null); setRoleAssignUserId(null) }}
                        title="Đặt lại mật khẩu"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {/* Assign admin role */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:text-primary"
                        onClick={() => { setRoleAssignUserId(roleAssignUserId === user.id ? null : user.id); setBalanceUserId(null); setResetPwUserId(null) }}
                        title="Gán vai trò admin"
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                      {/* Role toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-warning hover:text-warning"
                        onClick={() => handleRoleChange(user.id)}
                        title={isAdmin ? 'Hạ quyền' : 'Nâng Admin'}
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                      {/* Ban toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isBanned ? 'text-success' : 'text-warning'}`}
                        onClick={() => handleBanToggle(user.id)}
                        title={isBanned ? 'Mở khóa' : 'Khóa tài khoản'}
                      >
                        {isBanned ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </Button>
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(user.id)}
                        title="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Matched transactions from cross-table search */}
                {hitsById?.get(user.id) && (
                  (() => {
                    const hit = hitsById.get(user.id)!
                    const hasTopups = hit.topupMatches.length > 0
                    const hasOrders = hit.orderMatches.length > 0
                    if (!hasTopups && !hasOrders) return null
                    return (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                        {hit.topupMatches.slice(0, 3).map((t) => (
                          <div key={`t-${t.id}`} className="flex items-start gap-2 text-[11px] bg-primary/5 px-2 py-1.5 rounded">
                            <Receipt className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className="text-[9px] px-1 py-0">NẠP</Badge>
                                <span className={`text-[9px] px-1 py-0 rounded ${
                                  t.status === 'completed' ? 'bg-success/10 text-success' :
                                  t.status === 'pending' ? 'bg-warning/10 text-warning' :
                                  'bg-muted/30 text-muted-foreground'
                                }`}>{t.status}</span>
                                <span className="font-mono font-medium text-foreground">{t.transferCode || '—'}</span>
                                <span className="text-success">{formatVND(Number(t.amount || 0))}</span>
                              </div>
                              {t.bankDescription && (
                                <p className="text-muted-foreground truncate mt-0.5">{t.bankDescription}</p>
                              )}
                              {t.bankTransactionId && (
                                <p className="text-muted-foreground/70 font-mono text-[10px] truncate">TxID: {t.bankTransactionId}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(t.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        ))}
                        {hit.orderMatches.slice(0, 3).map((o) => (
                          <div key={`o-${o.id}`} className="flex items-start gap-2 text-[11px] bg-blue-500/5 px-2 py-1.5 rounded">
                            <ShoppingCart className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className="text-[9px] px-1 py-0">ĐƠN</Badge>
                                <span className={`text-[9px] px-1 py-0 rounded ${
                                  o.status === 'paid' || o.status === 'completed' ? 'bg-success/10 text-success' :
                                  o.status === 'pending' ? 'bg-warning/10 text-warning' :
                                  'bg-muted/30 text-muted-foreground'
                                }`}>{o.status}</span>
                                <span className="font-mono font-medium text-foreground">{o.orderNumber || '—'}</span>
                                <span className="text-success">{formatVND(Number(o.total || 0))}</span>
                              </div>
                              {o.note && (
                                <p className="text-muted-foreground truncate mt-0.5">{o.note}</p>
                              )}
                              {(o.transferCode || o.customerEmail) && (
                                <p className="text-muted-foreground/70 font-mono text-[10px] truncate">
                                  {o.transferCode ? `CK: ${o.transferCode}` : ''}
                                  {o.transferCode && o.customerEmail ? ' · ' : ''}
                                  {o.customerEmail || ''}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(o.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        ))}
                        {(hit.topupMatches.length + hit.orderMatches.length) > 6 && (
                          <p className="text-[10px] text-muted-foreground text-center">
                            + {hit.topupMatches.length + hit.orderMatches.length - 6} giao dịch khác khớp
                          </p>
                        )}
                      </div>
                    )
                  })()
                )}

                {/* Balance adjustment form */}
                {balanceUserId === user.id && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
                    <Wallet className="h-4 w-4 text-success shrink-0" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={balanceAmount ? Number(balanceAmount).toLocaleString('vi-VN') : ''}
                      onChange={(e) => setBalanceAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="Số tiền (VND) — VD: 10.000"
                      className="bg-muted/50 font-mono h-8 text-sm flex-1 min-w-[120px]"
                      disabled={balanceProcessing !== null}
                    />
                    {balanceAmount && Number(balanceAmount) > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        = {formatVND(Number(balanceAmount))}
                      </span>
                    )}
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleAddBalance(user.id)}
                      disabled={balanceProcessing !== null}
                    >
                      {balanceProcessing === 'add' ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <ArrowUpCircle className="mr-1 h-3 w-3" />
                      )}
                      {balanceProcessing === 'add' ? 'Đang cộng...' : 'Cộng'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs"
                      onClick={() => handleDeductBalance(user.id)}
                      disabled={balanceProcessing !== null}
                    >
                      {balanceProcessing === 'deduct' ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <ArrowDownCircle className="mr-1 h-3 w-3" />
                      )}
                      {balanceProcessing === 'deduct' ? 'Đang trừ...' : 'Trừ'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setBalanceUserId(null)}
                      disabled={balanceProcessing !== null}
                    >
                      Hủy
                    </Button>
                  </div>
                )}

                {/* Role assign form */}
                {roleAssignUserId === user.id && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
                    <UserCog className="h-4 w-4 text-primary shrink-0" />
                    <select
                      className="bg-muted/50 h-8 text-sm flex-1 min-w-[160px] px-2 rounded-md border border-input"
                      defaultValue={userAssignments[user.id]?.role_id || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '') handleAssignRole(user.id, null)
                        else handleAssignRole(user.id, Number(val))
                      }}
                      disabled={roleAssigning}
                    >
                      <option value="">— Không có vai trò —</option>
                      {availableRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}{r.description ? ` — ${r.description}` : ''}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setRoleAssignUserId(null)}>
                      Đóng
                    </Button>
                  </div>
                )}

                {/* Password reset form */}
                {resetPwUserId === user.id && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
                    <KeyRound className="h-4 w-4 text-primary shrink-0" />
                    <Input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                      className="bg-muted/50 h-8 text-sm flex-1 min-w-[180px]"
                      autoComplete="off"
                    />
                    <Button size="sm" className="h-8 text-xs" onClick={() => handleResetPassword(user.id)}>
                      <KeyRound className="mr-1 h-3 w-3" />
                      Đặt lại
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setResetPwUserId(null); setNewPassword('') }}>
                      Hủy
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AdminPagination
        currentPage={page} totalPages={totalPages}
        totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setPage}
      />
      </>)
      })()}

      {!loading && dbUsers.length === 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Chưa có người dùng nào trong hệ thống. Người dùng sẽ xuất hiện khi đăng ký tại /dang-ky</span>
          </div>
        </div>
      )}
    </div>
  )
}
