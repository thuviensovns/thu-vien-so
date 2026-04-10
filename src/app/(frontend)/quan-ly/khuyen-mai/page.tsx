'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Tag, Plus, Trash2, ToggleLeft, ToggleRight,
  Percent, Banknote, Calendar, Hash, Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatVND, formatDate } from '@/lib/format'
import { toast } from 'sonner'

interface Coupon {
  id: number
  code: string
  type: 'percent' | 'fixed'
  value: number
  minOrder: number
  maxUses: number
  usedCount: number
  active: boolean
  expiresAt: string | null
  createdAt: string
}

export default function CouponPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    code: '',
    type: 'percent' as 'percent' | 'fixed',
    value: '',
    minOrder: '',
    maxUses: '',
    expiresAt: '',
  })

  const fetchCoupons = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/coupons', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setCoupons(data.docs || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  async function handleCreate() {
    if (!form.code.trim()) {
      toast.error('Vui lòng nhập mã giảm giá')
      return
    }
    const value = parseInt(form.value)
    if (isNaN(value) || value <= 0) {
      toast.error('Giá trị không hợp lệ')
      return
    }
    if (form.type === 'percent' && value > 100) {
      toast.error('Phần trăm không thể lớn hơn 100%')
      return
    }
    if (coupons.some((c) => c.code.toUpperCase() === form.code.toUpperCase())) {
      toast.error('Mã giảm giá đã tồn tại')
      return
    }

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: form.code.toUpperCase().trim(),
          type: form.type,
          value,
          minOrder: parseInt(form.minOrder) || 0,
          maxUses: parseInt(form.maxUses) || 0,
          expiresAt: form.expiresAt || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Lỗi tạo mã giảm giá')
        return
      }
      toast.success(`Đã tạo mã ${form.code.toUpperCase()}`)
      setForm({ code: '', type: 'percent', value: '', minOrder: '', maxUses: '', expiresAt: '' })
      setShowForm(false)
      fetchCoupons()
    } catch {
      toast.error('Lỗi kết nối')
    }
  }

  async function handleToggle(id: number, currentActive: boolean) {
    try {
      await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, active: !currentActive }),
      })
      setCoupons((prev) => prev.map((c) => c.id === id ? { ...c, active: !currentActive } : c))
    } catch {
      toast.error('Lỗi cập nhật')
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/admin/coupons?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setCoupons((prev) => prev.filter((c) => c.id !== id))
      toast.info('Đã xóa mã giảm giá')
    } catch {
      toast.error('Lỗi xóa mã giảm giá')
    }
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    setForm((prev) => ({ ...prev, code }))
  }

  const activeCoupons = coupons.filter((c) => c.active)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Tag className="h-5 w-5 text-purple-500" />
            Mã giảm giá
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeCoupons.length} đang hoạt động / {coupons.length} tổng
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Tạo mã
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple-500" />
              Tạo mã giảm giá mới
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Mã giảm giá</label>
                <div className="flex gap-2">
                  <Input
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="VD: SALE50"
                    className="bg-muted/50 font-mono uppercase"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={generateCode} className="shrink-0 text-xs">
                    <Hash className="mr-1 h-3 w-3" />
                    Tạo
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Loại & Giá trị</label>
                <div className="flex gap-2">
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as 'percent' | 'fixed' }))}
                    className="rounded-md border border-border bg-muted/50 px-2 py-2 text-sm outline-none"
                  >
                    <option value="percent">% Phần trăm</option>
                    <option value="fixed">VND Cố định</option>
                  </select>
                  <Input
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                    placeholder={form.type === 'percent' ? '10' : '50000'}
                    className="bg-muted/50 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Đơn tối thiểu (VND)</label>
                <Input
                  type="number"
                  value={form.minOrder}
                  onChange={(e) => setForm((p) => ({ ...p, minOrder: e.target.value }))}
                  placeholder="0 = không giới hạn"
                  className="bg-muted/50 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Số lần sử dụng tối đa</label>
                <Input
                  type="number"
                  value={form.maxUses}
                  onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))}
                  placeholder="0 = không giới hạn"
                  className="bg-muted/50 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium mb-1 block">Ngày hết hạn (để trống = vô thời hạn)</label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                  className="bg-muted/50"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} className="bg-purple-600 hover:bg-purple-600/90 text-white">
                <Tag className="mr-1.5 h-3.5 w-3.5" />
                Tạo mã giảm giá
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupons list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Đang tải...</span>
        </div>
      ) : coupons.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <Tag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Chưa có mã giảm giá</p>
            <p className="text-xs text-muted-foreground mt-1">Tạo mã giảm giá để thu hút khách hàng</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {coupons.map((coupon) => {
            const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date()
            const isMaxed = coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses
            return (
              <Card key={coupon.id} className={`border-border bg-card ${!coupon.active ? 'opacity-60' : ''}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <button type="button" onClick={() => handleToggle(coupon.id, coupon.active)} className="shrink-0">
                    {coupon.active ? (
                      <ToggleRight className="h-6 w-6 text-success" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-primary">{coupon.code}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {coupon.type === 'percent' ? (
                          <><Percent className="h-2.5 w-2.5 mr-0.5" />{coupon.value}%</>
                        ) : (
                          <><Banknote className="h-2.5 w-2.5 mr-0.5" />{formatVND(coupon.value)}</>
                        )}
                      </Badge>
                      {isExpired && <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">Hết hạn</Badge>}
                      {isMaxed && <Badge className="text-[10px] bg-warning/10 text-warning border-warning/20">Hết lượt</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                      <span>Đã dùng: {coupon.usedCount}{coupon.maxUses > 0 ? `/${coupon.maxUses}` : ''}</span>
                      {coupon.minOrder > 0 && <span>• Đơn tối thiểu: {formatVND(coupon.minOrder)}</span>}
                      {coupon.expiresAt && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatDate(coupon.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDelete(coupon.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
