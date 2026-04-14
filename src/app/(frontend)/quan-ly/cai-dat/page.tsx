'use client'

import { useState, useEffect } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import {
  Settings, Save, Check, RotateCcw, Globe, Phone, Mail, Share2,
  Search, Layout, Bell, CreditCard, Download, FileText, Shield,
  Eye, EyeOff, MapPin, MessageCircle, Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  getSiteSettings, saveSiteSettings, defaultSiteSettings,
  type SiteSettings,
} from '@/lib/config'
import { formatVND } from '@/lib/format'
import { logActivity } from '@/lib/admin-helpers'
import { toast } from 'sonner'

type SectionKey = 'website' | 'contact' | 'social' | 'seo' | 'hero' | 'announcement' | 'payment' | 'download' | 'footer'

const sections: { key: SectionKey; label: string; icon: typeof Globe; desc: string }[] = [
  { key: 'website', label: 'Thông tin website', icon: Globe, desc: 'Tên, mô tả, logo' },
  { key: 'contact', label: 'Liên hệ', icon: Phone, desc: 'Email, SĐT, địa chỉ' },
  { key: 'social', label: 'Mạng xã hội', icon: Share2, desc: 'Facebook, YouTube, TikTok...' },
  { key: 'seo', label: 'SEO & Meta', icon: Search, desc: 'Tiêu đề, mô tả, từ khóa' },
  { key: 'hero', label: 'Trang chủ (Hero)', icon: Layout, desc: 'Tiêu đề, mô tả hero' },
  { key: 'announcement', label: 'Thông báo', icon: Bell, desc: 'Banner thông báo' },
  { key: 'payment', label: 'Thanh toán & Phí', icon: CreditCard, desc: 'Nạp tiền, phí công cụ AI' },
  { key: 'download', label: 'Download', icon: Download, desc: 'Giới hạn tải xuống' },
  { key: 'footer', label: 'Footer', icon: FileText, desc: 'Chân trang, copyright' },
]

export default function SettingsPage() {
  const [form, setForm] = useState<SiteSettings>(defaultSiteSettings)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionKey>('website')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    // Load from DB first, fallback to localStorage
    async function loadSettings() {
      try {
        const res = await fetch('/api/site-content', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.settings && Object.keys(data.settings).length > 0) {
            setForm({ ...defaultSiteSettings, ...data.settings })
            return
          }
        }
      } catch { /* fallback */ }
      setForm(getSiteSettings())
    }
    loadSettings()
  }, [])

  function handleSave() {
    saveSiteSettings(form)
    logActivity('settings', 'Cập nhật cài đặt', `Mục: tất cả`)
    setSaved(true)
    toast.success('Đã lưu cài đặt! Reload trang để áp dụng thay đổi.')
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleReset() {
    const confirmed = await confirmDialog({
      title: 'Khôi phục mặc định',
      description: 'Khôi phục tất cả cài đặt về mặc định? Thay đổi hiện tại sẽ bị mất.',
      confirmText: 'Khôi phục',
      variant: 'destructive',
    })
    if (!confirmed) return
    setForm(defaultSiteSettings)
    localStorage.removeItem('admin_site_settings')
    logActivity('settings', 'Khôi phục mặc định', 'Tất cả cài đặt')
    toast.info('Đã khôi phục cài đặt mặc định')
  }

  function handleResetSection(section: SectionKey) {
    const sectionDefaults = getSectionFields(section)
    const reset: Partial<SiteSettings> = {}
    for (const field of sectionDefaults) {
      ;(reset as Record<string, unknown>)[field.key] = defaultSiteSettings[field.key]
    }
    setForm((prev) => ({ ...prev, ...reset }))
    toast.info(`Đã khôi phục mục "${sections.find((s) => s.key === section)?.label}"`)
  }

  function update(key: keyof SiteSettings, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function getSectionFields(section: SectionKey): { key: keyof SiteSettings; label: string; type: 'text' | 'number' | 'textarea' | 'toggle'; placeholder?: string; icon?: typeof Globe; help?: string; min?: number; step?: number }[] {
    switch (section) {
      case 'website': return [
        { key: 'siteName', label: 'Tên trang web', type: 'text', placeholder: 'Thư Viện Số', icon: Globe },
        { key: 'siteDescription', label: 'Mô tả ngắn', type: 'text', placeholder: 'Tài nguyên FLP, VST, Sample Pack...', help: 'Hiển thị ở nhiều nơi trong trang' },
        { key: 'siteUrl', label: 'URL trang web', type: 'text', placeholder: 'https://thuvienflstudio.com' },
        { key: 'logoText', label: 'Text Logo', type: 'text', placeholder: 'Thư Viện Số', help: 'Hiển thị ở header & footer' },
      ]
      case 'contact': return [
        { key: 'contactEmail', label: 'Email', type: 'text', placeholder: 'support@...', icon: Mail },
        { key: 'contactPhone', label: 'Số điện thoại', type: 'text', placeholder: '0876 096 170', icon: Phone },
        { key: 'contactAddress', label: 'Địa chỉ', type: 'text', placeholder: 'TP. Hà Nội, Việt Nam', icon: MapPin },
      ]
      case 'social': return [
        { key: 'facebook', label: 'Facebook', type: 'text', placeholder: 'https://facebook.com/...' },
        { key: 'youtube', label: 'YouTube', type: 'text', placeholder: 'https://youtube.com/...' },
        { key: 'tiktok', label: 'TikTok', type: 'text', placeholder: 'https://tiktok.com/...' },
        { key: 'zalo', label: 'Zalo', type: 'text', placeholder: 'https://zalo.me/...', icon: MessageCircle },
        { key: 'telegram', label: 'Telegram', type: 'text', placeholder: 'https://t.me/...', icon: Send },
      ]
      case 'seo': return [
        { key: 'metaTitle', label: 'Meta Title', type: 'text', placeholder: 'Thư Viện Số — ...', help: 'Tiêu đề hiển thị trên Google (50-60 ký tự)' },
        { key: 'metaDescription', label: 'Meta Description', type: 'textarea', placeholder: 'Download Sample Pack, FLP Project...', help: 'Mô tả trên Google (150-160 ký tự)' },
        { key: 'metaKeywords', label: 'Từ khóa SEO', type: 'textarea', placeholder: 'fl studio, sample pack, vst plugin...', help: 'Phân cách bởi dấu phẩy' },
      ]
      case 'hero': return [
        { key: 'heroTitle', label: 'Tiêu đề Hero', type: 'text', placeholder: 'Thư Viện Số Việt Nam', help: 'Tiêu đề lớn ở trang chủ' },
        { key: 'heroSubtitle', label: 'Mô tả Hero', type: 'textarea', placeholder: 'Download Sample Pack, FLP Project...', help: 'Đoạn text bên dưới tiêu đề' },
        { key: 'heroBadge', label: 'Badge Hero (tùy chọn)', type: 'text', placeholder: 'VD: 🔥 Khuyến mãi đặc biệt!', help: 'Nhãn nhỏ phía trên tiêu đề. Để trống = dùng mặc định' },
      ]
      case 'announcement': return [
        { key: 'announcementEnabled', label: 'Hiện thông báo', type: 'toggle' },
        { key: 'announcementText', label: 'Nội dung thông báo', type: 'text', placeholder: '🎉 Sale 50% tất cả sản phẩm!', help: 'Hiển thị ở đầu trang web' },
        { key: 'announcementLink', label: 'Link thông báo (tùy chọn)', type: 'text', placeholder: '/san-pham', help: 'Click vào thông báo sẽ chuyển đến link này' },
      ]
      case 'payment': return [
        { key: 'minTopup', label: 'Số tiền nạp tối thiểu (VND)', type: 'number', min: 1000, step: 1000 },
        { key: 'sevenTrackFee', label: 'Phí tách 7 Tracks AI (VND)', type: 'number', min: 0, step: 1000, help: 'Phí mỗi lần sử dụng tính năng tách 7 tracks. Đặt 0 = miễn phí. Admin luôn miễn phí.' },
      ]
      case 'download': return [
        { key: 'maxDownloads', label: 'Số lần tải tối đa / sản phẩm', type: 'number', min: 1, step: 1, help: 'Giới hạn lượt tải cho mỗi sản phẩm đã mua' },
        { key: 'downloadExpiryHours', label: 'Thời hạn tải (giờ)', type: 'number', min: 1, step: 1, help: 'Sau thời gian này link tải sẽ hết hạn' },
      ]
      case 'footer': return [
        { key: 'footerText', label: 'Mô tả footer', type: 'textarea', placeholder: 'Tài nguyên FLP, VST, Sample Pack...', help: 'Đoạn text ở chân trang' },
        { key: 'copyrightText', label: 'Copyright (tùy chọn)', type: 'text', placeholder: '© 2024 Thư Viện Số', help: 'Để trống = tự động tạo' },
      ]
      default: return []
    }
  }

  const currentSection = sections.find((s) => s.key === activeSection)!
  const fields = getSectionFields(activeSection)
  const Icon = currentSection.icon

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Cài đặt chung
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý toàn bộ cấu hình trang web — thay đổi sẽ áp dụng ngay khi lưu
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Mặc định
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saved ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            {saved ? 'Đã lưu!' : 'Lưu tất cả'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Sidebar nav */}
        <div className="lg:w-56 shrink-0">
          <div className="lg:sticky lg:top-[4.5rem] space-y-1">
            {sections.map((sec) => {
              const SecIcon = sec.icon
              const isActive = sec.key === activeSection
              return (
                <button
                  key={sec.key}
                  onClick={() => setActiveSection(sec.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <SecIcon className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{sec.label}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">{currentSection.label}</h3>
                    <p className="text-[10px] text-muted-foreground">{currentSection.desc}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => handleResetSection(activeSection)}
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Reset mục này
                </Button>
              </div>

              <Separator className="mb-4" />

              <div className="space-y-4">
                {fields.map((field) => {
                  const value = form[field.key]

                  if (field.type === 'toggle') {
                    return (
                      <div key={field.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                        <div>
                          <p className="text-sm font-medium">{field.label}</p>
                          {field.help && <p className="text-[10px] text-muted-foreground mt-0.5">{field.help}</p>}
                        </div>
                        <button
                          onClick={() => update(field.key, !value)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            value ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                              value ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    )
                  }

                  if (field.type === 'textarea') {
                    return (
                      <div key={field.key}>
                        <label className="text-xs font-medium mb-1.5 block">{field.label}</label>
                        <textarea
                          value={String(value || '')}
                          onChange={(e) => update(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm outline-none resize-none min-h-[80px] focus:border-primary/50 transition-colors"
                          rows={3}
                        />
                        {field.help && <p className="text-[10px] text-muted-foreground mt-1">{field.help}</p>}
                      </div>
                    )
                  }

                  if (field.type === 'number') {
                    return (
                      <div key={field.key}>
                        <label className="text-xs font-medium mb-1.5 block">{field.label}</label>
                        <Input
                          type="number"
                          value={Number(value) || ''}
                          onChange={(e) => update(field.key, parseInt(e.target.value) || 0)}
                          className="bg-muted/50 font-mono"
                          min={field.min}
                          step={field.step}
                        />
                        {field.help && <p className="text-[10px] text-muted-foreground mt-1">{field.help}</p>}
                        {field.key === 'minTopup' && (
                          <p className="text-[10px] text-muted-foreground mt-1">Hiện tại: {formatVND(Number(value) || 0)}</p>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div key={field.key}>
                      <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
                        {field.icon && <field.icon className="h-3.5 w-3.5" />}
                        {field.label}
                      </label>
                      <Input
                        value={String(value || '')}
                        onChange={(e) => update(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="bg-muted/50"
                      />
                      {field.help && <p className="text-[10px] text-muted-foreground mt-1">{field.help}</p>}
                    </div>
                  )
                })}
              </div>

              <Separator className="my-5" />

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {saved ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                  {saved ? 'Đã lưu!' : 'Lưu cài đặt'}
                </Button>
                <Button variant="outline" onClick={() => handleResetSection(activeSection)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset mục này
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick preview */}
          {activeSection === 'announcement' && form.announcementEnabled && form.announcementText && (
            <Card className="border-primary/20 bg-primary/5 mt-4">
              <CardContent className="p-4">
                <p className="text-xs font-bold mb-2 text-muted-foreground">Xem trước thông báo:</p>
                <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 text-center">
                  <p className="text-sm font-medium text-primary">{form.announcementText}</p>
                  {form.announcementLink && (
                    <p className="text-[10px] text-primary/60 mt-0.5">→ {form.announcementLink}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'seo' && (
            <Card className="border-border bg-card mt-4">
              <CardContent className="p-4">
                <p className="text-xs font-bold mb-2 text-muted-foreground">Xem trước trên Google:</p>
                <div className="bg-white rounded-lg p-4 text-left border">
                  <p className="text-blue-600 text-base font-medium truncate">
                    {form.metaTitle || 'Thư Viện Số'}
                  </p>
                  <p className="text-green-700 text-xs mt-0.5 truncate">
                    {form.siteUrl || 'https://thuvienso.com'}
                  </p>
                  <p className="text-gray-600 text-xs mt-1 line-clamp-2">
                    {form.metaDescription || 'Download Sample Pack, FLP Project, VST Plugin & Preset cho Producer'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
