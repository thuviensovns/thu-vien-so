'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RefreshCw, Type, FileText, Search, Globe, MessageSquare, Tag,
  Music, Headphones, Zap, Sliders, Guitar, Mic, Monitor, Package, Check, RotateCcw,
  Megaphone, Save, Upload, Loader2, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSiteSettings, saveSiteSettings, defaultSiteSettings, type SiteSettings } from '@/lib/config'
import { demoCategoryDescriptions, getCategoryDescriptions, saveCategoryDescriptions } from '@/lib/demo-data'
import { categoryMeta } from '@/lib/config'
import { logActivity } from '@/lib/admin-helpers'
import {
  spinSiteField, spinAllSiteContent, spinCategoryDescription,
  getFullSitePool, getFullCategoryPool,
  addCustomSiteVariation, removeCustomSiteVariation,
  addCustomCategoryVariation, removeCustomCategoryVariation,
} from '@/lib/content-spinner'
import SpinField from './SpinField'

const catIcons: Record<string, React.ElementType> = {
  'sample-pack': Music, 'flp': Headphones, 'vst': Zap,
  'preset': Sliders, 'instrument': Guitar, 'song-nhac-lyrics': Mic, 'cai-dat-phan-mem': Monitor,
}

type SpinnableField = 'heroTitle' | 'heroSubtitle' | 'heroBadge' | 'footerText' | 'metaTitle' | 'metaDescription' | 'announcementText'

const fieldLabels: Record<SpinnableField, { label: string; icon: React.ElementType; desc: string }> = {
  heroTitle: { label: 'Tiêu đề Hero', icon: Type, desc: 'Tiêu đề chính trang chủ' },
  heroSubtitle: { label: 'Mô tả Hero', icon: FileText, desc: 'Mô tả phụ bên dưới tiêu đề' },
  heroBadge: { label: 'Badge Hero', icon: Tag, desc: 'Nhãn nhỏ phía trên tiêu đề' },
  footerText: { label: 'Footer', icon: MessageSquare, desc: 'Văn bản chân trang' },
  metaTitle: { label: 'SEO Title', icon: Search, desc: 'Tiêu đề hiển thị trên Google' },
  metaDescription: { label: 'SEO Description', icon: Globe, desc: 'Mô tả hiển thị trên Google' },
  announcementText: { label: 'Thông báo', icon: Megaphone, desc: 'Banner thông báo trên cùng' },
}

const spinFieldOrder: SpinnableField[] = ['heroTitle', 'heroSubtitle', 'heroBadge', 'metaTitle', 'metaDescription', 'footerText', 'announcementText']

export default function ContentSpinnerPage() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings)
  const [catDescs, setCatDescs] = useState<Record<string, string>>(demoCategoryDescriptions)
  const [spinning, setSpinning] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [expandedField, setExpandedField] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const refresh = useCallback(() => {
    setSettings(getSiteSettings())
    setCatDescs(getCategoryDescriptions())
    setRefreshKey(k => k + 1)
  }, [])

  // Sync all current content to database (explicit manual sync)
  const syncToServer = useCallback(async (currentSettings?: SiteSettings, currentCatDescs?: Record<string, string>) => {
    setSyncing(true)
    setSyncStatus('idle')
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings: currentSettings || getSiteSettings(),
          categoryDescriptions: currentCatDescs || getCategoryDescriptions(),
        }),
      })
      if (res.ok) {
        setSyncStatus('success')
        toast.success('Đã đồng bộ nội dung lên server!')
        setTimeout(() => setSyncStatus('idle'), 3000)
      } else {
        const errText = res.status === 401 ? 'Bạn cần đăng nhập admin để đồng bộ.' : `Lỗi server (${res.status})`
        setSyncStatus('error')
        toast.error(errText)
        setTimeout(() => setSyncStatus('idle'), 3000)
      }
    } catch {
      setSyncStatus('error')
      toast.error('Lỗi kết nối. Vui lòng thử lại.')
      setTimeout(() => setSyncStatus('idle'), 3000)
    }
    setSyncing(false)
  }, [])

  // Auto-seed DB on first mount
  const seededRef = useRef(false)
  useEffect(() => {
    refresh()
    if (!seededRef.current) {
      seededRef.current = true
      syncToServer()
    }
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_site_settings' || e.key === 'admin_category_descriptions' || e.key === 'admin_custom_variations') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh, syncToServer])

  const showSaved = (key: string) => { setSaved(key); setTimeout(() => setSaved(null), 1500) }

  // Resolve saved state for a given key
  function getSavedState(key: string): string | null {
    if (saved === key) return 'saved'
    if (saved === `save-${key}`) return 'save-variation'
    if (saved === `dup-${key}`) return 'duplicate'
    return null
  }

  // --- Site field handlers ---
  const handleSpinField = (field: SpinnableField) => {
    setSpinning(field)
    setTimeout(() => {
      const newVal = spinSiteField(field, settings[field] as string)
      const updated = { ...settings, [field]: newVal }
      setSettings(updated); saveSiteSettings(updated)
      logActivity('settings', 'Spin nội dung', `${fieldLabels[field].label}: "${newVal.slice(0, 50)}..."`)
      setSpinning(null); showSaved(field)
    }, 300)
  }

  const handleEditField = (field: SpinnableField, value: string) => {
    const updated = { ...settings, [field]: value }
    setSettings(updated); saveSiteSettings(updated)
  }

  const handleResetField = (field: SpinnableField) => {
    const updated = { ...settings, [field]: defaultSiteSettings[field] }
    setSettings(updated); saveSiteSettings(updated)
    logActivity('settings', 'Reset nội dung', fieldLabels[field].label); showSaved(field)
  }

  const handleSaveAsVariation = (field: SpinnableField) => {
    const ok = addCustomSiteVariation(field, settings[field] as string)
    if (ok) { logActivity('settings', 'Lưu biến thể', fieldLabels[field].label); showSaved(`save-${field}`); setRefreshKey(k => k + 1) }
    else showSaved(`dup-${field}`)
  }

  // --- Category handlers ---
  const handleSpinCategory = (slug: string) => {
    setSpinning(`cat-${slug}`)
    setTimeout(() => {
      const current = catDescs[slug] || demoCategoryDescriptions[slug]
      const newDesc = spinCategoryDescription(slug, current)
      const updated = { ...catDescs, [slug]: newDesc }
      setCatDescs(updated); saveCategoryDescriptions(updated)
      const catName = categoryMeta.find(c => c.slug === slug)?.name || slug
      logActivity('settings', 'Spin danh mục', `${catName}: "${newDesc.slice(0, 50)}..."`)
      setSpinning(null); showSaved(`cat-${slug}`)
    }, 300)
  }

  const handleEditCategory = (slug: string, value: string) => {
    const updated = { ...catDescs, [slug]: value }
    setCatDescs(updated); saveCategoryDescriptions(updated)
  }

  const handleResetCategory = (slug: string) => {
    const updated = { ...catDescs }; delete updated[slug]
    setCatDescs({ ...demoCategoryDescriptions, ...updated }); saveCategoryDescriptions(updated); showSaved(`cat-${slug}`)
  }

  const handleSaveCategoryVariation = (slug: string) => {
    const value = catDescs[slug] || demoCategoryDescriptions[slug]
    const ok = addCustomCategoryVariation(slug, value)
    if (ok) { showSaved(`save-cat-${slug}`); setRefreshKey(k => k + 1) }
    else showSaved(`dup-cat-${slug}`)
  }

  // --- Bulk actions ---
  const handleSpinAll = () => {
    setSpinning('all')
    setTimeout(() => {
      const spun = spinAllSiteContent(settings)
      const updated = { ...settings, ...spun }; setSettings(updated); saveSiteSettings(updated)
      const newDescs = { ...catDescs }
      for (const cat of categoryMeta) {
        newDescs[cat.slug] = spinCategoryDescription(cat.slug, catDescs[cat.slug] || demoCategoryDescriptions[cat.slug])
      }
      setCatDescs(newDescs); saveCategoryDescriptions(newDescs)
      logActivity('settings', 'Spin tất cả nội dung', 'Đã cập nhật toàn bộ nội dung trang web')
      setSpinning(null); showSaved('all')
      // Auto-sync to server after spin all
      syncToServer(updated, newDescs)
    }, 500)
  }

  const handleResetAll = () => {
    const updated = { ...settings }
    for (const field of spinFieldOrder) (updated as Record<string, unknown>)[field] = defaultSiteSettings[field]
    setSettings(updated); saveSiteSettings(updated)
    setCatDescs(demoCategoryDescriptions); saveCategoryDescriptions({})
    logActivity('settings', 'Reset tất cả nội dung', 'Đã khôi phục toàn bộ nội dung mặc định')
    showSaved('all')
    // Auto-sync reset to server
    const resetSettings = { ...defaultSiteSettings }
    syncToServer(resetSettings, demoCategoryDescriptions)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />Spin Nội Dung
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Thay đổi nội dung trang web ngay lập tức</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => syncToServer()}
            disabled={syncing}
            className={`text-xs ${syncStatus === 'success' ? 'border-success/30 text-success' : syncStatus === 'error' ? 'border-destructive/30 text-destructive' : ''}`}
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> :
             syncStatus === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> :
             syncStatus === 'error' ? <XCircle className="h-3.5 w-3.5 mr-1" /> :
             <Upload className="h-3.5 w-3.5 mr-1" />}
            {syncing ? 'Đang đồng bộ...' : syncStatus === 'success' ? 'Đã đồng bộ!' : syncStatus === 'error' ? 'Lỗi đồng bộ' : 'Đồng bộ server'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetAll} className="text-xs">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset tất cả
          </Button>
          <Button size="sm" onClick={handleSpinAll} disabled={spinning === 'all'} className="text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${spinning === 'all' ? 'animate-spin' : ''}`} />Spin tất cả
          </Button>
        </div>
      </div>

      {saved === 'all' && (
        <div className="flex items-center gap-2 text-xs text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">
          <Check className="h-3.5 w-3.5" />Đã cập nhật toàn bộ nội dung!
        </div>
      )}

      {/* Site Content Fields */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 sm:p-5">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />Nội dung trang web
          </h3>
          <div className="space-y-5">
            {spinFieldOrder.map((field) => {
              const { label, icon, desc } = fieldLabels[field]
              const { builtIn, custom } = getFullSitePool(field)
              return (
                <SpinField
                  key={`${field}-${refreshKey}`}
                  label={label} icon={icon} description={desc}
                  currentValue={settings[field] as string}
                  builtIn={builtIn} custom={custom}
                  isSpinning={spinning === field}
                  savedState={getSavedState(field)}
                  isExpanded={expandedField === field}
                  rows={field === 'heroSubtitle' || field === 'metaDescription' ? 2 : 1}
                  onEdit={(v) => handleEditField(field, v)}
                  onSpin={() => handleSpinField(field)}
                  onSaveVariation={() => handleSaveAsVariation(field)}
                  onReset={() => handleResetField(field)}
                  onToggleExpand={() => setExpandedField(prev => prev === field ? null : field)}
                  onUseVariation={(v) => { handleEditField(field, v); showSaved(field) }}
                  onDeleteCustomVariation={(i) => { removeCustomSiteVariation(field, i); setRefreshKey(k => k + 1) }}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Category Descriptions */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 sm:p-5">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />Mô tả danh mục
          </h3>
          <div className="space-y-5">
            {categoryMeta.map((cat) => {
              const expandKey = `cat-${cat.slug}`
              const { builtIn, custom } = getFullCategoryPool(cat.slug)
              return (
                <SpinField
                  key={`${expandKey}-${refreshKey}`}
                  label={cat.name} icon={catIcons[cat.slug] || Package}
                  currentValue={catDescs[cat.slug] || demoCategoryDescriptions[cat.slug]}
                  builtIn={builtIn} custom={custom}
                  isSpinning={spinning === expandKey}
                  savedState={getSavedState(expandKey)}
                  isExpanded={expandedField === expandKey}
                  rows={2}
                  onEdit={(v) => handleEditCategory(cat.slug, v)}
                  onSpin={() => handleSpinCategory(cat.slug)}
                  onSaveVariation={() => handleSaveCategoryVariation(cat.slug)}
                  onReset={() => handleResetCategory(cat.slug)}
                  onToggleExpand={() => setExpandedField(prev => prev === expandKey ? null : expandKey)}
                  onUseVariation={(v) => { handleEditCategory(cat.slug, v); showSaved(expandKey) }}
                  onDeleteCustomVariation={(i) => { removeCustomCategoryVariation(cat.slug, i); setRefreshKey(k => k + 1) }}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <h3 className="text-xs font-bold mb-2 text-primary">Hướng dẫn sử dụng</h3>
          <ul className="text-[11px] text-muted-foreground space-y-1 leading-relaxed">
            <li>• Nhấn <RefreshCw className="h-3 w-3 inline text-primary" /> để spin ngẫu nhiên. Nhấn <Save className="h-3 w-3 inline text-primary" /> để lưu biến thể tùy chỉnh.</li>
            <li>• Nhấn &quot;Xem biến thể&quot; để xem, chọn hoặc xóa biến thể. Mọi thay đổi cập nhật ngay trên web.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
