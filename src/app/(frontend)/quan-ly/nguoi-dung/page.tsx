'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Users, ShieldCheck, User, Mail, Trash2, AlertCircle,
  Search, Ban, CheckCircle2, Wallet, ArrowUpCircle, FileDown, Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatVND } from '@/lib/format'
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

export default function UsersPage() {
  const [dbUsers, setDbUsers] = useState<DemoUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [balanceUserId, setBalanceUserId] = useState<string | null>(null)
  const [balanceAmount, setBalanceAmount] = useState('')
  const [page, setPage] = useState(1)

  // Fetch real users from Payload API
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?limit=500&sort=-createdAt', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const users: DemoUser[] = (data.docs || []).map((u: PayloadUser) => ({
          id: String(u.id),
          email: u.email,
          displayName: u.displayName || '',
          role: (u.role as 'admin' | 'customer') || 'customer',
          balance: Number(u.balance || 0),
        }))
        setDbUsers(users)
      }
    } catch {
      // Fallback to demo users if API fails
      setDbUsers(getDemoUsers())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Refresh on focus
  useEffect(() => {
    const refresh = () => fetchUsers()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [fetchUsers])

  const allUsers = dbUsers

  const filtered = useMemo(() => {
    if (!search) return allUsers
    const q = search.toLowerCase()
    return allUsers.filter((u) =>
      u.email.toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q)
    )
  }, [allUsers, search])

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
    const amount = parseInt(balanceAmount)
    if (isNaN(amount) || amount < 1000) {
      toast.error('Số tiền tối thiểu 1.000₫')
      return
    }
    const user = allUsers.find((u) => u.id === userId)
    if (!user) return

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
      toast.success(`Đã cộng ${formatVND(amount)} cho ${user.displayName || user.email}`, {
        description: `Số dư mới: ${formatVND(data.newBalance)}`,
      })
      // Update balance locally
      setDbUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, balance: data.newBalance } : u
      ))
    } catch {
      toast.error('Lỗi kết nối')
    }
    setBalanceUserId(null)
    setBalanceAmount('')
  }

  function handleExport() {
    const csv = [
      'ID,Email,Tên,Quyền,Trạng thái',
      ...allUsers.map((u) =>
        `${u.id},${u.email},${u.displayName || ''},${u.role || 'customer'},${u.banned ? 'banned' : 'active'}`
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
          placeholder="Tìm theo email hoặc tên..."
          className="pl-9 bg-muted/50"
        />
      </div>

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
                    </div>
                  </div>

                  {/* Actions */}
                  {!isBuiltInAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Balance button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-success hover:text-success"
                        onClick={() => setBalanceUserId(balanceUserId === user.id ? null : user.id)}
                        title="Cộng tiền"
                      >
                        <ArrowUpCircle className="h-4 w-4" />
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

                {/* Balance adjustment form */}
                {balanceUserId === user.id && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-success shrink-0" />
                    <Input
                      type="number"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                      placeholder="Số tiền (VND)"
                      className="bg-muted/50 font-mono h-8 text-sm flex-1"
                      min={1000}
                      step={1000}
                    />
                    <Button size="sm" className="h-8 text-xs" onClick={() => handleAddBalance(user.id)}>
                      Cộng tiền
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setBalanceUserId(null)}>
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
