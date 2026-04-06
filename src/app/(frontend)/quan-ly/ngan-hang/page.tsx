'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Save, RotateCcw, Check, CreditCard, Star, Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  defaultBankAccount, getBankAccount, saveBankAccount,
  buildVietQRUrl, MIN_TOPUP, type BankAccount,
} from '@/lib/config'
import { logActivity } from '@/lib/admin-helpers'
import { toast } from 'sonner'
import BankProfileList, { type SavedBankProfile } from './BankProfileList'
import QRPreview from './QRPreview'

const popularBanks = [
  { bin: '970422', name: 'MB Bank' }, { bin: '970415', name: 'VietinBank' },
  { bin: '970436', name: 'Vietcombank' }, { bin: '970418', name: 'BIDV' },
  { bin: '970407', name: 'Techcombank' }, { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' }, { bin: '970423', name: 'TPBank' },
  { bin: '970448', name: 'OCB' }, { bin: '970403', name: 'Sacombank' },
  { bin: '970437', name: 'HDBank' }, { bin: '970441', name: 'VIB' },
  { bin: '970405', name: 'Agribank' }, { bin: '970443', name: 'SHB' },
  { bin: '970431', name: 'Eximbank' }, { bin: '970454', name: 'Việt Capital Bank' },
]

function getSavedProfiles(): SavedBankProfile[] {
  try { return JSON.parse(localStorage.getItem('admin_bank_profiles') || '[]') } catch { return [] }
}
function saveBankProfiles(profiles: SavedBankProfile[]) {
  try { localStorage.setItem('admin_bank_profiles', JSON.stringify(profiles)) } catch {}
}

export default function BankSettingsPage() {
  const [form, setForm] = useState<BankAccount>(defaultBankAccount)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<SavedBankProfile[]>([])
  const [profileLabel, setProfileLabel] = useState('')
  const [showProfileForm, setShowProfileForm] = useState(false)

  useEffect(() => {
    setForm(getBankAccount())
    setProfiles(getSavedProfiles())
  }, [])

  const previewQr = useMemo(
    () => buildVietQRUrl(MIN_TOPUP, 'PREVIEW', form as BankAccount),
    [form.bankBin, form.accountNumber, form.accountName, form.bankName],
  )

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key); toast.success('Đã sao chép!')
      setTimeout(() => setCopied(null), 2000)
    } catch { toast.error('Không thể sao chép') }
  }

  async function handleSave() {
    if (!form.bankBin || !form.accountNumber || !form.accountName || !form.bankName) {
      toast.error('Vui lòng điền đầy đủ thông tin'); return
    }
    // Save to localStorage (backward compat)
    saveBankAccount(form)
    // Save to server (so all users/devices get the same bank info)
    try {
      await fetch('/api/bank-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
    } catch {}
    logActivity('settings', 'Cập nhật tài khoản ngân hàng', `${form.bankName} — ${form.accountNumber}`)
    setSaved(true); toast.success('Đã lưu cài đặt ngân hàng!')
    setTimeout(() => setSaved(false), 2000)
    const updatedProfiles = profiles.map((p) => p.isActive ? { ...p, account: form } : p)
    saveBankProfiles(updatedProfiles); setProfiles(updatedProfiles)
  }

  function handleReset() {
    setForm({ ...defaultBankAccount }); saveBankAccount({ ...defaultBankAccount })
    const updatedProfiles = profiles.map((p) => ({ ...p, isActive: false }))
    saveBankProfiles(updatedProfiles); setProfiles(updatedProfiles)
    logActivity('settings', 'Khôi phục tài khoản ngân hàng mặc định', defaultBankAccount.bankName)
    toast.info('Đã khôi phục cài đặt mặc định')
  }

  function handleSaveProfile() {
    if (!profileLabel.trim()) { toast.error('Vui lòng nhập tên cho hồ sơ'); return }
    if (!form.bankBin || !form.accountNumber) { toast.error('Vui lòng điền thông tin ngân hàng trước'); return }
    const newProfile: SavedBankProfile = {
      id: `bp-${Date.now()}`, label: profileLabel.trim(),
      account: { ...form }, isActive: false, createdAt: new Date().toISOString(),
    }
    const updated = [...profiles, newProfile]
    saveBankProfiles(updated); setProfiles(updated)
    setProfileLabel(''); setShowProfileForm(false)
    logActivity('settings', 'Lưu hồ sơ ngân hàng', `${profileLabel} — ${form.bankName}`)
    toast.success(`Đã lưu hồ sơ "${profileLabel}"`)
  }

  function handleActivateProfile(id: string) {
    const profile = profiles.find((p) => p.id === id)
    if (!profile) return
    setForm(profile.account); saveBankAccount(profile.account)
    const updated = profiles.map((p) => ({ ...p, isActive: p.id === id }))
    saveBankProfiles(updated); setProfiles(updated)
    logActivity('settings', 'Chuyển tài khoản ngân hàng', `${profile.label}`)
    toast.success(`Đã kích hoạt hồ sơ "${profile.label}"`)
  }

  function handleDeleteProfile(id: string) {
    const profile = profiles.find((p) => p.id === id)
    const updated = profiles.filter((p) => p.id !== id)
    saveBankProfiles(updated); setProfiles(updated)
    if (profile) toast.info(`Đã xóa hồ sơ "${profile.label}"`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />Quản lý tài khoản ngân hàng
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Cấu hình tài khoản ngân hàng để tạo QR thanh toán tự động</p>
      </div>

      <BankProfileList profiles={profiles} onActivate={handleActivateProfile} onDelete={handleDeleteProfile} onToggleForm={() => setShowProfileForm(!showProfileForm)} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <Card className="border-border bg-card">
          <CardContent className="p-5 space-y-5">
            {/* Bank selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Chọn ngân hàng</label>
              <div className="flex flex-wrap gap-2">
                {popularBanks.map((b) => (
                  <button key={b.bin} type="button" onClick={() => setForm((prev) => ({ ...prev, bankBin: b.bin, bankName: b.name }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.bankBin === b.bin ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/30 border-border text-muted-foreground hover:border-border/80'
                    }`}
                  >{b.name}</button>
                ))}
              </div>
            </div>
            <Separator />

            {/* Form fields */}
            {[
              { id: 'bankBin', label: 'Mã BIN ngân hàng', key: 'bankBin' as const, placeholder: '970422', mono: true, hint: 'Mã BIN dùng để tạo QR VietQR' },
              { id: 'bankName', label: 'Tên ngân hàng', key: 'bankName' as const, placeholder: 'ACB' },
            ].map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className="text-sm font-medium mb-1.5 block">{field.label}</label>
                <Input id={field.id} value={form[field.key]} onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))} placeholder={field.placeholder} className={`bg-muted/50 ${field.mono ? 'font-mono' : ''}`} />
                {field.hint && <p className="text-[11px] text-muted-foreground mt-1">{field.hint}</p>}
              </div>
            ))}

            <div>
              <label htmlFor="accountNumber" className="text-sm font-medium mb-1.5 block">Số tài khoản</label>
              <div className="flex gap-2">
                <Input id="accountNumber" value={form.accountNumber} onChange={(e) => setForm((prev) => ({ ...prev, accountNumber: e.target.value }))} placeholder="0876 096 170" className="bg-muted/50 font-mono text-lg" />
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyText(form.accountNumber, 'stk')}>
                  {copied === 'stk' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <label htmlFor="accountName" className="text-sm font-medium mb-1.5 block">Tên chủ tài khoản</label>
              <Input id="accountName" value={form.accountName} onChange={(e) => setForm((prev) => ({ ...prev, accountName: e.target.value.toUpperCase() }))} placeholder="THU VIEN SO" className="bg-muted/50 font-mono uppercase" />
              <p className="text-[11px] text-muted-foreground mt-1">In hoa, không dấu — hiển thị trên QR code</p>
            </div>

            <Separator />

            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saved ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                {saved ? 'Đã lưu!' : 'Lưu & Áp dụng'}
              </Button>
              <Button variant="outline" onClick={handleReset}><RotateCcw className="mr-2 h-4 w-4" />Khôi phục mặc định</Button>
              <Button variant="outline" onClick={() => setShowProfileForm(!showProfileForm)}><Star className="mr-2 h-4 w-4" />Lưu hồ sơ</Button>
            </div>

            {showProfileForm && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20">
                <Input value={profileLabel} onChange={(e) => setProfileLabel(e.target.value)} placeholder="Tên hồ sơ (VD: TK Chính)" className="bg-muted/50 text-sm flex-1" />
                <Button size="sm" onClick={handleSaveProfile}><Save className="mr-1 h-3 w-3" />Lưu</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowProfileForm(false)}>Hủy</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <QRPreview form={form} previewQr={previewQr} />
      </div>
    </div>
  )
}
