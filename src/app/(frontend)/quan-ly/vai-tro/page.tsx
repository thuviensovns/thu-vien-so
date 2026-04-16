'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, Plus, Trash2, Edit3, Users as UsersIcon,
  Save, X, Loader2, AlertCircle, Lock,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { PERMISSION_CATEGORIES, type PermissionKey, ALL_PERMISSIONS } from '@/lib/permissions'

interface Role {
  id: number
  name: string
  description: string | null
  permissions: string[]
  is_system: boolean
  assigned_count: number
  created_at: string
  updated_at: string
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    name: string
    description: string
    permissions: Set<PermissionKey>
  }>({ name: '', description: '', permissions: new Set() })

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/roles', { credentials: 'include', cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 403) toast.error('Bạn không có quyền xem vai trò')
        else toast.error('Không tải được danh sách')
        setRoles([])
        return
      }
      const data = await res.json()
      setRoles(data.docs || [])
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  function resetForm() {
    setForm({ name: '', description: '', permissions: new Set() })
    setEditingId(null)
    setCreating(false)
  }

  function startCreate() {
    resetForm()
    setCreating(true)
  }

  function startEdit(role: Role) {
    setForm({
      name: role.name,
      description: role.description || '',
      permissions: new Set(role.permissions as PermissionKey[]),
    })
    setEditingId(role.id)
    setCreating(false)
  }

  function togglePermission(key: PermissionKey) {
    setForm((f) => {
      const next = new Set(f.permissions)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { ...f, permissions: next }
    })
  }

  function toggleCategory(catKey: string) {
    const cat = PERMISSION_CATEGORIES.find((c) => c.key === catKey)
    if (!cat) return
    setForm((f) => {
      const next = new Set(f.permissions)
      const keys = cat.permissions.map((p) => p.key)
      const allOn = keys.every((k) => next.has(k))
      if (allOn) keys.forEach((k) => next.delete(k))
      else keys.forEach((k) => next.add(k))
      return { ...f, permissions: next }
    })
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Thiếu tên vai trò')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        permissions: Array.from(form.permissions),
      }
      const res = editingId
        ? await fetch(`/api/admin/roles/${editingId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/admin/roles', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Lỗi lưu vai trò')
        return
      }
      toast.success(editingId ? 'Đã cập nhật' : 'Đã tạo vai trò mới')
      resetForm()
      fetchRoles()
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(role: Role) {
    if (role.is_system) {
      toast.error('Không thể xóa vai trò hệ thống')
      return
    }
    if (role.assigned_count > 0) {
      toast.error(`Đang có ${role.assigned_count} user gán vai trò này`)
      return
    }
    if (!confirm(`Xóa vai trò "${role.name}"?`)) return
    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Lỗi xóa')
        return
      }
      toast.success('Đã xóa vai trò')
      fetchRoles()
    } catch {
      toast.error('Lỗi kết nối')
    }
  }

  const isEditing = editingId !== null || creating
  const editingRole = editingId ? roles.find((r) => r.id === editingId) : null
  const isSuperAdmin = editingRole?.name === 'super_admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-warning" />
            Vai trò & Phân quyền
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tạo vai trò tùy biến và gán cho sub-admin. Chủ sở hữu luôn có tất cả quyền.
          </p>
        </div>
        {!isEditing && (
          <Button size="sm" onClick={startCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tạo vai trò mới
          </Button>
        )}
      </div>

      {/* Edit/Create form */}
      {isEditing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                {editingId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? `Sửa vai trò: ${editingRole?.name}` : 'Vai trò mới'}
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {isSuperAdmin && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs">
                <Lock className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span>Super admin có tất cả quyền — không thể sửa danh sách quyền, chỉ đổi được mô tả.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tên vai trò</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="vd: moderator_pro"
                  disabled={!!editingRole?.is_system}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Mô tả (tùy chọn)</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="vd: Kiểm duyệt nội dung + đơn hàng"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Quyền ({form.permissions.size}/{ALL_PERMISSIONS.length})
                </label>
                {!isSuperAdmin && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => setForm({ ...form, permissions: new Set(ALL_PERMISSIONS) })}
                    >
                      Tất cả
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => setForm({ ...form, permissions: new Set() })}
                    >
                      Bỏ chọn
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {PERMISSION_CATEGORIES.map((cat) => {
                  const allOn = cat.permissions.every((p) => form.permissions.has(p.key))
                  const someOn = cat.permissions.some((p) => form.permissions.has(p.key))
                  return (
                    <div key={cat.key} className="border border-border/50 rounded-lg p-3 bg-background/50">
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allOn}
                            ref={(el) => {
                              if (el) el.indeterminate = someOn && !allOn
                            }}
                            onChange={() => toggleCategory(cat.key)}
                            disabled={isSuperAdmin}
                            className="rounded border-border"
                          />
                          <span className="font-medium text-sm">{cat.label}</span>
                        </label>
                        <span className="text-[10px] text-muted-foreground">
                          {cat.permissions.filter((p) => form.permissions.has(p.key)).length}/
                          {cat.permissions.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-5">
                        {cat.permissions.map((p) => (
                          <label key={p.key} className="flex items-center gap-2 text-xs cursor-pointer py-1">
                            <input
                              type="checkbox"
                              checked={form.permissions.has(p.key)}
                              onChange={() => togglePermission(p.key)}
                              disabled={isSuperAdmin}
                              className="rounded border-border"
                            />
                            <span>{p.label}</span>
                            <code className="text-[9px] text-muted-foreground ml-auto font-mono">
                              {p.key}
                            </code>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button variant="ghost" onClick={resetForm} disabled={saving}>Hủy</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                {editingId ? 'Lưu thay đổi' : 'Tạo vai trò'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roles list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Đang tải...</span>
        </div>
      ) : roles.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
          Chưa có vai trò nào.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {roles.map((role) => (
            <Card key={role.id} className={role.is_system ? 'border-warning/30' : 'border-border'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                    role.is_system ? 'bg-warning/10' : 'bg-primary/10'
                  }`}>
                    <ShieldCheck className={`h-5 w-5 ${role.is_system ? 'text-warning' : 'text-primary'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{role.name}</p>
                      {role.is_system && (
                        <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px]">SYSTEM</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {role.permissions.length} quyền
                      </Badge>
                      {role.assigned_count > 0 && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                          <UsersIcon className="h-2.5 w-2.5 mr-1" />
                          {role.assigned_count} user
                        </Badge>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{role.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => startEdit(role)}
                      title="Sửa"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    {!role.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(role)}
                        title="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
