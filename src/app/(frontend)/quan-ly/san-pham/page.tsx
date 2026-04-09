'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Package, Plus, Search, Trash2, FileDown, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatVND } from '@/lib/format'
import { categoryMeta } from '@/lib/config'
import {
  getAdminProducts, addAdminProduct, updateAdminProduct, deleteAdminProduct,
  getDeletedDemoIds, deleteDemoProduct, restoreDemoProduct,
  getDemoOverrides, saveDemoOverride, removeDemoOverride,
  type AdminProduct,
} from '@/lib/admin-helpers'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import AdminPagination, { paginate } from '@/components/admin/AdminPagination'
import ProductForm, { defaultForm, autoSlug, type ProductFormData } from './ProductForm'
import ProductTable, { type AnyProduct } from './ProductTable'
import { createProduct, updateProduct, deleteProduct as deletePayloadProduct, fetchProducts, fetchCategories, revalidateProductPages, checkPayloadAuth, uploadMedia } from '@/lib/payload-client'
import { mapPayloadDocs } from '@/lib/product-mapper'
import { useAuth } from '@/hooks/use-auth'

const ITEMS_PER_PAGE = 15


export default function ProductsPage() {
  const { user } = useAuth()
  const [adminProducts, setAdminProducts] = useState<AdminProduct[]>(() => getAdminProducts())
  const [deletedDemoIds, setDeletedDemoIds] = useState<string[]>(() => getDeletedDemoIds())
  const [demoOverrides, setDemoOverrides] = useState<Record<string, Partial<AdminProduct>>>(() => getDemoOverrides())
  const [dbProducts, setDbProducts] = useState<AnyProduct[]>([])
  const [useDb, setUseDb] = useState(false)
  const [catIdMap, setCatIdMap] = useState<Record<string, number>>({})

  // Ensure Payload auth before write operations
  const ensureAuth = useCallback(async (): Promise<boolean> => {
    const hasAuth = await checkPayloadAuth()
    if (hasAuth) return true
    toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.', {
      description: 'Hãy đăng xuất và đăng nhập lại để tiếp tục chỉnh sửa.',
    })
    return false
  }, [])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDemoId, setEditingDemoId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ProductFormData>(defaultForm)
  const [page, setPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [dbStatus, setDbStatus] = useState<'loading' | 'connected' | 'offline'>('loading')

  // Load products + categories from database on mount (with retry for cold starts)
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    async function loadFromDb(attempt = 1) {
      try {
        const [data, catData] = await Promise.all([fetchProducts({ limit: 200 }), fetchCategories()])
        // Build category slug -> id map
        if (catData && catData.docs) {
          const map: Record<string, number> = {}
          for (const c of catData.docs) map[String(c.slug)] = Number(c.id)
          setCatIdMap(map)
        }
        if (data && data.docs) {
          setDbProducts(mapPayloadDocs(data.docs))
          setUseDb(true)
          setDbStatus('connected')
          return
        }
      } catch {}

      // Retry up to 3 times (covers Neon cold start + Vercel function warmup)
      if (attempt < 3) {
        setDbStatus('loading')
        retryTimer = setTimeout(() => loadFromDb(attempt + 1), 3000)
      } else {
        setDbStatus('offline')
      }
    }

    loadFromDb()
    return () => { if (retryTimer) clearTimeout(retryTimer) }
  }, [])

  // Reload DB products after changes + revalidate customer pages
  const reloadDb = useCallback(async () => {
    try {
      const data = await fetchProducts({ limit: 200 })
      if (data && data.docs) {
        setDbProducts(mapPayloadDocs(data.docs))

      }
    } catch (err) {
      console.error('[Admin] Failed to reload products:', err)
    }
    // Await revalidation so customer pages get fresh data
    try {
      await revalidateProductPages()

    } catch (err) {
      console.error('[Admin] Revalidation failed:', err)
    }
  }, [])

  // Use DB products when available, otherwise empty
  const allProducts: AnyProduct[] = useMemo(() => {
    if (useDb) return dbProducts
    return []
  }, [useDb, dbProducts])

  const filtered = useMemo(() => {
    let result = showDeleted ? allProducts : allProducts.filter((p) => !('isDeleted' in p && p.isDeleted))
    if (filterType !== 'all') result = result.filter((p) => p.type === filterType)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
    }
    return result
  }, [allProducts, search, filterType, showDeleted])

  const activeCount = allProducts.filter((p) => !('isDeleted' in p && p.isDeleted)).length
  const deletedCount = deletedDemoIds.length

  function openEditForm(product: AnyProduct) {
    const isCustom = 'isCustom' in product && product.isCustom === true
    setEditingId(isCustom ? product.id : null)
    setEditingDemoId(isCustom ? null : product.id)
    const fileData = (product as any).file?.r2Key ? {
      r2Key: (product as any).file.r2Key,
      fileName: (product as any).file.fileName || '',
      fileSize: (product as any).file.fileSize || 0,
      fileFormat: (product as any).file.fileFormat || '',
    } : null
    setForm({
      name: product.name,
      slug: product.slug,
      type: product.type,
      thumbnailUrl: product.thumbnail?.url || '/images/placeholder.jpg',
      price: String(product.pricing.price),
      originalPrice: product.pricing.originalPrice ? String(product.pricing.originalPrice) : '',
      featured: product.featured || false,
      file: fileData,
      downloadUrl: (product as any).file?.downloadUrl || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Vui lòng nhập tên sản phẩm'); return }
    const price = parseInt(form.price) || 0
    const originalPrice = parseInt(form.originalPrice) || null
    const slug = form.slug.trim() || autoSlug(form.name)
    const catMeta = categoryMeta.find((c) => c.slug === form.type)

    const productData = {
      name: form.name.trim(),
      slug,
      type: form.type,
      thumbnail: { url: form.thumbnailUrl },
      pricing: { price, originalPrice, isFree: price === 0 },
      featured: form.featured,
      category: catMeta ? { slug: catMeta.slug, name: catMeta.name } : undefined,
    }

    if (useDb) {
      // Database mode: sync via Payload API
      const categoryId = catIdMap[form.type]

      setSaving(true)
      // Ensure we have a valid Payload session
      const authed = await ensureAuth()
      if (!authed) {
        console.error('[Save] Auth failed — aborting save')
        setSaving(false)
        return
      }
      try {
        // Upload image if user selected a new one (data URL)
        let thumbnailResult: number | string | null = null
        if (form.thumbnailUrl.startsWith('data:')) {
          toast.loading('Đang upload hình ảnh...', { id: 'img-upload' })
          thumbnailResult = await uploadMedia(form.thumbnailUrl, productData.slug)
          toast.dismiss('img-upload')
          if (!thumbnailResult) {
            toast.error('Lỗi upload hình ảnh', { description: 'Kiểm tra Console (F12) để xem chi tiết lỗi.' })
            setSaving(false)
            return
          }
          // If R2 returned a URL string, update the thumbnail URL in productData
          if (typeof thumbnailResult === 'string') {
            productData.thumbnail = { url: thumbnailResult }
          }
        }

        if (editingId) {
          const payload: Record<string, unknown> = {
            name: productData.name,
            slug: productData.slug,
            type: productData.type,
            pricing: productData.pricing,
            featured: productData.featured,
          }
          if (categoryId) payload.category = categoryId
          // thumbnail: Payload media ID (number) or R2 URL (string → stored in thumbnailUrl)
          if (typeof thumbnailResult === 'number') payload.thumbnail = thumbnailResult
          if (typeof thumbnailResult === 'string') payload.thumbnailUrl = thumbnailResult
          // Always send file group so downloadUrl can be set/cleared
          payload.file = {
            ...(form.file ? {
              r2Key: form.file.r2Key,
              fileName: form.file.fileName,
              fileSize: form.file.fileSize,
              fileFormat: form.file.fileFormat,
            } : {}),
            downloadUrl: form.downloadUrl.trim() || null,
          }
          const res = await updateProduct(editingId, payload)
          if (res.doc || res.id) {
            toast.success('Đã cập nhật & đồng bộ sản phẩm', { description: 'Trang khách hàng đã được cập nhật.' })
          } else {
            toast.error('Lỗi cập nhật: ' + (res.errors?.[0]?.message || res.message || 'Unknown'))
            setSaving(false)
            return
          }
        } else {
          const payload: Record<string, unknown> = {
            name: productData.name,
            slug: productData.slug,
            type: productData.type,
            pricing: productData.pricing,
            featured: productData.featured,
            ...(typeof thumbnailResult === 'number' ? { thumbnail: thumbnailResult } : { thumbnail: 1 }),
            ...(typeof thumbnailResult === 'string' ? { thumbnailUrl: thumbnailResult } : {}),
          }
          if (categoryId) payload.category = categoryId
          // Always send file group so downloadUrl is saved
          payload.file = {
            ...(form.file ? {
              r2Key: form.file.r2Key,
              fileName: form.file.fileName,
              fileSize: form.file.fileSize,
              fileFormat: form.file.fileFormat,
            } : {}),
            downloadUrl: form.downloadUrl.trim() || null,
          }
          const res = await createProduct(payload)
          if (res.doc || res.id) {
            toast.success('Đã thêm & đồng bộ sản phẩm mới', { description: 'Trang khách hàng đã được cập nhật.' })
          } else {
            toast.error('Lỗi tạo: ' + (res.errors?.[0]?.message || res.message || 'Unknown'))
            setSaving(false)
            return
          }
        }
        await reloadDb()
        setSaving(false)
      } catch (err) {
        console.error('[Save] Exception:', err)
        toast.error('Lỗi kết nối database')
        setSaving(false)
        return
      }
    } else {
      // localStorage fallback mode
      if (editingDemoId) {
        saveDemoOverride(editingDemoId, productData as Partial<AdminProduct>)
        setDemoOverrides(getDemoOverrides())
        toast.success('Đã cập nhật sản phẩm')
      } else if (editingId) {
        const ok = updateAdminProduct(editingId, productData)
        if (!ok) { toast.error('Lưu thất bại — dung lượng localStorage đầy.'); return }
        toast.success('Đã cập nhật sản phẩm')
      } else {
        const result = addAdminProduct(productData)
        if (!result) { toast.error('Lưu thất bại — dung lượng localStorage đầy.'); return }
        toast.success('Đã thêm sản phẩm mới')
      }
      setAdminProducts(getAdminProducts())
    }

    handleCancel()
  }

  async function handleDelete(product: AnyProduct) {
    const confirmed = await confirmDialog({
      title: 'Xóa sản phẩm',
      description: `Bạn có chắc muốn xóa "${product.name}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa',
      variant: 'destructive',
    })
    if (!confirmed) return

    if (useDb) {
      const authed = await ensureAuth()
      if (!authed) return
      try {
        await deletePayloadProduct(product.id)
        toast.success('Đã xóa sản phẩm')
        await reloadDb()
      } catch {
        toast.error('Lỗi xóa sản phẩm')
      }
      return
    }

    const isCustom = 'isCustom' in product && product.isCustom === true
    if (isCustom) {
      deleteAdminProduct(product.id)
      setAdminProducts(getAdminProducts())
    } else {
      deleteDemoProduct(product.id, product.name)
      setDeletedDemoIds(getDeletedDemoIds())
    }
    toast.success('Đã xóa sản phẩm')
  }

  function handleRestore(id: string) {
    restoreDemoProduct(id)
    removeDemoOverride(id)
    setDeletedDemoIds(getDeletedDemoIds())
    setDemoOverrides(getDemoOverrides())
    toast.success('Đã khôi phục sản phẩm')
  }

  function handleRestoreOriginal(id: string) {
    removeDemoOverride(id)
    setDemoOverrides(getDemoOverrides())
    toast.success('Đã khôi phục về bản gốc')
  }

  function handleCancel() {
    setShowForm(false)
    setEditingId(null)
    setEditingDemoId(null)
    setForm(defaultForm)
  }

  function handleExport() {
    const exportProducts = allProducts.filter((p) => !('isDeleted' in p && p.isDeleted))
    const csv = [
      'ID,Tên,Slug,Danh mục,Giá,Miễn phí,Nổi bật,Cập nhật',
      ...exportProducts.map((p) =>
        `${p.id},"${p.name}",${p.slug},${p.type},${p.pricing.price},${p.pricing.isFree ? 'Có' : 'Không'},${p.featured ? 'Có' : 'Không'},${p.updatedAt}`
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Đã xuất file CSV')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Quản lý sản phẩm
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>{activeCount} sản phẩm</span>
            {deletedCount > 0 && <span className="text-destructive">• {deletedCount} đã xóa</span>}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
              dbStatus === 'connected' ? 'bg-success/10 text-success' :
              dbStatus === 'offline' ? 'bg-warning/10 text-warning' :
              'bg-muted text-muted-foreground'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                dbStatus === 'connected' ? 'bg-success' :
                dbStatus === 'offline' ? 'bg-warning' :
                'bg-muted-foreground animate-pulse'
              }`} />
              {dbStatus === 'connected' ? 'Database' : dbStatus === 'offline' ? 'Demo mode' : 'Connecting...'}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExport}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button size="sm" onClick={() => { setEditingId(null); setEditingDemoId(null); setForm(defaultForm); setShowForm(!showForm) }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Thêm mới
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <ProductForm
          form={form}
          setForm={setForm}
          editingId={editingId}
          editingDemoId={editingDemoId}
          onSave={handleSave}
          onCancel={handleCancel}
          onRestoreOriginal={handleRestoreOriginal}
          saving={saving}
        />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Tìm theo tên hoặc slug..."
            className="pl-9 bg-muted/50"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => { setFilterType('all'); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
              filterType === 'all'
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            Tất cả
          </button>
          {categoryMeta.map((c) => (
            <button
              key={c.slug}
              onClick={() => { setFilterType(c.slug); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                filterType === c.slug
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted/30 border-border text-muted-foreground'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Show deleted toggle */}
      {deletedCount > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showDeleted
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            <Trash2 className="inline h-3 w-3 mr-1" />
            {showDeleted ? 'Ẩn đã xóa' : `Hiện ${deletedCount} đã xóa`}
          </button>
        </div>
      )}

      {/* Products table */}
      {(() => {
        const { paged, totalPages } = paginate(filtered, page, ITEMS_PER_PAGE)
        return (<>
          <ProductTable
            products={paged}
            demoOverrides={demoOverrides}
            onEdit={openEditForm}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onRestoreOriginal={handleRestoreOriginal}
          />
          <AdminPagination
            currentPage={page} totalPages={totalPages}
            totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setPage}
          />
        </>)
      })()}

      {/* Info */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>Tất cả sản phẩm đều có thể chỉnh sửa và xóa. Sản phẩm demo đã chỉnh sửa sẽ hiện badge &quot;Đã sửa&quot; — bạn có thể khôi phục về bản gốc bất cứ lúc nào.</p>
            <p>Sản phẩm demo đã xóa có thể khôi phục. Click &quot;Hiện đã xóa&quot; để xem và khôi phục.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
