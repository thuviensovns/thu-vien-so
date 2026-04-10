'use client'

/** Dispatch storage event for same-tab reactivity */
function notifyStorage(key: string) {
  try { window.dispatchEvent(new StorageEvent('storage', { key })) } catch {}
}

// --- Activity Log ---

export interface ActivityEntry {
  id: string
  type: 'order' | 'user' | 'topup' | 'coupon' | 'settings' | 'system' | 'product'
  action: string
  detail: string
  timestamp: string
  adminEmail?: string
}

export function logActivity(type: ActivityEntry['type'], action: string, detail: string, adminEmail?: string) {
  // Write to localStorage for backward compat
  try {
    const entries: ActivityEntry[] = JSON.parse(localStorage.getItem('admin_activity_log') || '[]')
    entries.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      action,
      detail,
      timestamp: new Date().toISOString(),
      ...(adminEmail ? { adminEmail } : {}),
    })
    localStorage.setItem('admin_activity_log', JSON.stringify(entries.slice(0, 200)))
  } catch {}

  // Also write to DB (fire and forget)
  try {
    fetch('/api/admin/activity-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type, action, detail }),
    }).catch(() => {})
  } catch {}
}

export function getActivityLog(): ActivityEntry[] {
  try {
    return JSON.parse(localStorage.getItem('admin_activity_log') || '[]')
  } catch {
    return []
  }
}

export function clearActivityLog() {
  localStorage.removeItem('admin_activity_log')
}

// --- Coupon System ---

export interface Coupon {
  id: string
  code: string
  type: 'percent' | 'fixed'
  value: number          // percent (0-100) or VND amount
  minOrder: number       // min order to apply
  maxUses: number        // 0 = unlimited
  usedCount: number
  active: boolean
  expiresAt: string | null
  createdAt: string
}

export function getCoupons(): Coupon[] {
  try {
    return JSON.parse(localStorage.getItem('admin_coupons') || '[]')
  } catch {
    return []
  }
}

export function saveCoupons(coupons: Coupon[]) {
  try {
    localStorage.setItem('admin_coupons', JSON.stringify(coupons))
  } catch {}
}

export function addCoupon(coupon: Omit<Coupon, 'id' | 'usedCount' | 'createdAt'>): Coupon {
  const newCoupon: Coupon = {
    ...coupon,
    id: `coupon-${Date.now()}`,
    usedCount: 0,
    createdAt: new Date().toISOString(),
  }
  const all = getCoupons()
  all.unshift(newCoupon)
  saveCoupons(all)
  logActivity('coupon', 'Tạo mã giảm giá', `${coupon.code} — ${coupon.type === 'percent' ? coupon.value + '%' : coupon.value + 'đ'}`)
  return newCoupon
}

export function toggleCoupon(id: string) {
  const all = getCoupons()
  const coupon = all.find((c) => c.id === id)
  if (coupon) {
    coupon.active = !coupon.active
    saveCoupons(all)
    logActivity('coupon', coupon.active ? 'Kích hoạt mã' : 'Vô hiệu hóa mã', coupon.code)
  }
}

export function deleteCoupon(id: string) {
  const all = getCoupons()
  const coupon = all.find((c) => c.id === id)
  saveCoupons(all.filter((c) => c.id !== id))
  if (coupon) logActivity('coupon', 'Xóa mã giảm giá', coupon.code)
}

// --- Top-up History ---

export interface TopUpEntry {
  id: string
  userId: string
  userEmail: string
  amount: number
  method: string
  status: 'completed' | 'pending' | 'rejected'
  transferCode: string
  createdAt: string
}

export function getTopUpHistory(): TopUpEntry[] {
  try {
    return JSON.parse(localStorage.getItem('admin_topup_history') || '[]')
  } catch {
    return []
  }
}

export function saveTopUpEntry(entry: Omit<TopUpEntry, 'id' | 'createdAt'>) {
  try {
    const all = getTopUpHistory()
    all.unshift({
      ...entry,
      id: `topup-${Date.now()}`,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('admin_topup_history', JSON.stringify(all))
    logActivity('topup', 'Nạp tiền', `${entry.userEmail} — ${entry.amount.toLocaleString()}đ`)
  } catch {}
}

// --- Order helpers ---

export interface DemoOrder {
  id: string
  orderNumber: string
  email: string
  items: { name: string; price: number }[]
  total: number
  method: string
  status: 'paid' | 'pending' | 'failed'
  createdAt: string
  note?: string
}

export function getDemoOrders(): DemoOrder[] {
  try {
    return JSON.parse(localStorage.getItem('demo_orders') || '[]')
  } catch {
    return []
  }
}

export function saveDemoOrders(orders: DemoOrder[]) {
  try {
    localStorage.setItem('demo_orders', JSON.stringify(orders))
  } catch {}
}

export function updateOrderStatus(orderId: string, status: DemoOrder['status']) {
  const orders = getDemoOrders()
  const order = orders.find((o) => o.id === orderId)
  if (order) {
    order.status = status
    saveDemoOrders(orders)
    logActivity('order', `Cập nhật đơn hàng → ${status}`, order.orderNumber)
  }
}

// --- User helpers ---

export interface DemoUser {
  id: string
  email: string
  displayName?: string
  role?: 'admin' | 'customer'
  banned?: boolean
  balance?: number
  createdAt?: string
}

export function getDemoUsers(): DemoUser[] {
  try {
    return JSON.parse(localStorage.getItem('demo_users') || '[]')
  } catch {
    return []
  }
}

export function saveDemoUsers(users: DemoUser[]) {
  try {
    localStorage.setItem('demo_users', JSON.stringify(users))
  } catch {}
}

// --- Product Management (admin custom products stored in localStorage) ---

export interface AdminProduct {
  id: string
  name: string
  slug: string
  type: string
  thumbnail: { url: string }
  pricing: { price: number; originalPrice?: number | null; isFree?: boolean }
  downloadCount: number
  featured?: boolean
  category?: { slug: string; name: string }
  updatedAt: string
  createdAt: string
  isCustom: true // flag to distinguish from hardcoded demo products
}

export function getAdminProducts(): AdminProduct[] {
  try {
    return JSON.parse(localStorage.getItem('admin_products') || '[]')
  } catch {
    return []
  }
}

export function saveAdminProducts(products: AdminProduct[]): boolean {
  try {
    localStorage.setItem('admin_products', JSON.stringify(products))
    notifyStorage('admin_products')
    return true
  } catch {
    return false
  }
}

export function addAdminProduct(product: Omit<AdminProduct, 'id' | 'createdAt' | 'updatedAt' | 'isCustom' | 'downloadCount'>): AdminProduct | null {
  const now = new Date().toISOString()
  const newProduct: AdminProduct = {
    ...product,
    id: `prod-${Date.now()}`,
    downloadCount: 0,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  }
  const all = getAdminProducts()
  all.unshift(newProduct)
  if (!saveAdminProducts(all)) return null
  logActivity('product', 'Thêm sản phẩm mới', newProduct.name)
  return newProduct
}

export function updateAdminProduct(id: string, updates: Partial<AdminProduct>): boolean {
  const all = getAdminProducts()
  const idx = all.findIndex((p) => p.id === id)
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() }
    if (!saveAdminProducts(all)) return false
    logActivity('product', 'Cập nhật sản phẩm', all[idx].name)
    return true
  }
  return false
}

export function deleteAdminProduct(id: string) {
  const all = getAdminProducts()
  const product = all.find((p) => p.id === id)
  saveAdminProducts(all.filter((p) => p.id !== id))
  if (product) logActivity('product', 'Xóa sản phẩm', product.name)
}

// --- Demo Product Overrides (edit/delete hardcoded demo products) ---

/** Get list of deleted demo product IDs */
export function getDeletedDemoIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem('deleted_demo_products') || '[]')
  } catch {
    return []
  }
}

/** Mark a demo product as deleted */
export function deleteDemoProduct(id: string, name: string) {
  const ids = getDeletedDemoIds()
  if (!ids.includes(id)) {
    ids.push(id)
    try { localStorage.setItem('deleted_demo_products', JSON.stringify(ids)); notifyStorage('deleted_demo_products') } catch {}
  }
  logActivity('product', 'Xóa sản phẩm (demo)', name)
}

/** Restore a deleted demo product */
export function restoreDemoProduct(id: string) {
  const ids = getDeletedDemoIds().filter((x) => x !== id)
  try { localStorage.setItem('deleted_demo_products', JSON.stringify(ids)); notifyStorage('deleted_demo_products') } catch {}
}

/** Get demo product overrides (edits to hardcoded demo products) */
export function getDemoOverrides(): Record<string, Partial<AdminProduct>> {
  try {
    return JSON.parse(localStorage.getItem('demo_product_overrides') || '{}')
  } catch {
    return {}
  }
}

/** Save an override for a demo product */
export function saveDemoOverride(id: string, updates: Partial<AdminProduct>) {
  const overrides = getDemoOverrides()
  overrides[id] = { ...overrides[id], ...updates, updatedAt: new Date().toISOString() }
  try { localStorage.setItem('demo_product_overrides', JSON.stringify(overrides)); notifyStorage('demo_product_overrides') } catch {}
  logActivity('product', 'Cập nhật sản phẩm (demo)', updates.name || id)
}

/** Remove override for a demo product (restore original) */
export function removeDemoOverride(id: string) {
  const overrides = getDemoOverrides()
  delete overrides[id]
  try { localStorage.setItem('demo_product_overrides', JSON.stringify(overrides)); notifyStorage('demo_product_overrides') } catch {}
}

// --- Revenue Analytics ---

export function getRevenueByDay(): { date: string; revenue: number; orders: number }[] {
  const orders = getDemoOrders().filter((o) => o.status === 'paid')
  const map: Record<string, { revenue: number; orders: number }> = {}

  orders.forEach((o) => {
    const date = o.createdAt.slice(0, 10)
    if (!map[date]) map[date] = { revenue: 0, orders: 0 }
    map[date].revenue += o.total
    map[date].orders += 1
  })

  // Fill last 7 days
  const result: { date: string; revenue: number; orders: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const key = date.toISOString().slice(0, 10)
    result.push({ date: key, ...map[key] || { revenue: 0, orders: 0 } })
  }
  return result
}

// --- Data Export ---

const ADMIN_STORAGE_KEYS = [
  'admin_activity_log', 'admin_coupons', 'admin_topup_history',
  'admin_products', 'demo_orders', 'demo_users', 'demo_passwords',
  'admin_sessions', 'admin_login_history', 'admin_site_settings',
  'admin_bank_account', 'admin_chat_config', 'admin_custom_variations',
  'deleted_demo_products', 'demo_product_overrides',
]

export function exportAllData(): string {
  const data: Record<string, unknown> = {}
  ADMIN_STORAGE_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key)
    if (raw) {
      try { data[key] = JSON.parse(raw) } catch { data[key] = raw }
    }
  })
  return JSON.stringify(data, null, 2)
}
