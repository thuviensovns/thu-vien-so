/** Site-wide configuration constants */
export const siteConfig = {
  name: 'Thư Viện Số',
  description: 'Tài nguyên FLP, VST, Sample Pack cho Producer Việt Nam',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://thuvienso.top',
  contact: {
    email: 'support.thuvienso@gmail.com',
    phone: '0876 096 170',
  },
  social: {
    facebook: 'https://facebook.com/@thuviensovnso',
    youtube: 'https://www.youtube.com/@thuviensovns',
    tiktok: 'https://www.tiktok.com/@thuviensovns',
  },
} as const

/** Navigation items shared between desktop and mobile nav */
export const navItems = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Sample Pack', href: '/danh-muc/sample-pack' },
  { label: 'FLP Project', href: '/danh-muc/flp' },
  { label: 'VST Plugin', href: '/danh-muc/vst' },
  { label: 'Preset', href: '/danh-muc/preset' },
  { label: 'Instrument', href: '/danh-muc/instrument' },
  { label: 'Sóng nhạc Lyrics', href: '/danh-muc/song-nhac-lyrics' },
  { label: 'Blog', href: '/blog' },
] as const

/** Product type labels for display */
export const typeLabels: Record<string, string> = {
  'sample-pack': 'Sample Pack',
  flp: 'FLP Project',
  vst: 'VST Plugin',
  preset: 'Preset',
  instrument: 'Instrument',
  'song-nhac-lyrics': 'Sóng nhạc Lyrics',
}

/** Category metadata for homepage and navigation */
export const categoryMeta = [
  {
    name: 'Sample Pack',
    slug: 'sample-pack',
    description: 'Bộ sưu tập âm thanh EDM, Vinahouse, Trap',
    iconName: 'Music' as const,
  },
  {
    name: 'FLP Project',
    slug: 'flp',
    description: 'File project FL Studio sẵn sàng sử dụng',
    iconName: 'Headphones' as const,
  },
  {
    name: 'VST Plugin',
    slug: 'vst',
    description: 'Nexus, Serum, Spire, Sylenth1, Kontakt',
    iconName: 'Zap' as const,
  },
  {
    name: 'Preset',
    slug: 'preset',
    description: 'Preset chất lượng cho các synth phổ biến',
    iconName: 'Sliders' as const,
  },
  {
    name: 'Instrument',
    slug: 'instrument',
    description: 'Ample, SWAM, và các nhạc cụ ảo chất lượng',
    iconName: 'Guitar' as const,
  },
  {
    name: 'Sóng nhạc Lyrics',
    slug: 'song-nhac-lyrics',
    description: 'Sóng nhạc và lyrics video cho sản xuất âm nhạc',
    iconName: 'Mic' as const,
  },
] as const

/** Payment method options */
export const paymentMethods = [
  { id: 'bank-transfer', name: 'Chuyển khoản QR', description: 'Quét mã QR chuyển khoản ngân hàng — xác nhận tự động' },
  { id: 'vnpay', name: 'VNPay', description: 'Thanh toán qua ví VNPay, thẻ ATM, Visa/Master' },
  { id: 'momo', name: 'MoMo', description: 'Thanh toán qua ví điện tử MoMo' },
] as const

/**
 * Default bank account info for QR transfers.
 * Admin can override via /quan-ly/ngan-hang — stored in localStorage.
 * BIN list: https://api.vietqr.io/v2/banks
 */
export const defaultBankAccount = {
  bankBin: '970423',        // Mã BIN ngân hàng (TPBank)
  bankName: 'TPBank',      // Tên ngân hàng hiển thị
  accountNumber: '10000936292', // Số tài khoản
  accountName: 'HOANG ANH DUNG', // Tên chủ tài khoản (in hoa, không dấu)
}

export type BankAccount = typeof defaultBankAccount

/** Get current bank account (admin-configured or default) */
export function getBankAccount(): BankAccount {
  if (typeof window === 'undefined') return defaultBankAccount
  try {
    const stored = localStorage.getItem('admin_bank_account')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.bankBin && parsed.accountNumber && parsed.accountName && parsed.bankName) {
        return parsed
      }
    }
  } catch {}
  return defaultBankAccount
}

/** Save bank account settings (admin only) */
export function saveBankAccount(account: BankAccount) {
  try {
    localStorage.setItem('admin_bank_account', JSON.stringify(account))
    window.dispatchEvent(new StorageEvent('storage', { key: 'admin_bank_account' }))
  } catch {}
}

/** Build a VietQR image URL for the given amount + content */
export function buildVietQRUrl(amount: number, content: string, bankOverride?: BankAccount) {
  const bank = bankOverride ?? getBankAccount()
  const encoded = encodeURIComponent(content)
  const encodedName = encodeURIComponent(bank.accountName)
  return `https://img.vietqr.io/image/${bank.bankBin}-${bank.accountNumber}-compact2.png?amount=${amount}&addInfo=${encoded}&accountName=${encodedName}`
}

/** Minimum top-up amount (VND) */
export const MIN_TOPUP = 10000

// --- Dynamic Site Settings (admin-configurable via /quan-ly/cai-dat) ---

export interface SiteSettings {
  // Website info
  siteName: string
  siteDescription: string
  siteUrl: string
  logoText: string
  // Contact
  contactEmail: string
  contactPhone: string
  contactAddress: string
  // Social
  facebook: string
  youtube: string
  tiktok: string
  zalo: string
  telegram: string
  // SEO
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  // Homepage hero
  heroTitle: string
  heroSubtitle: string
  heroBadge: string
  // Announcement banner
  announcementEnabled: boolean
  announcementText: string
  announcementLink: string
  // Payment & limits
  minTopup: number
  maxDownloads: number
  downloadExpiryHours: number
  // Footer
  footerText: string
  copyrightText: string
}

export const defaultSiteSettings: SiteSettings = {
  siteName: siteConfig.name,
  siteDescription: siteConfig.description,
  siteUrl: siteConfig.url,
  logoText: 'Thư Viện Số',
  contactEmail: siteConfig.contact.email,
  contactPhone: siteConfig.contact.phone,
  contactAddress: '',
  facebook: siteConfig.social.facebook,
  youtube: siteConfig.social.youtube,
  tiktok: siteConfig.social.tiktok,
  zalo: '',
  telegram: '',
  metaTitle: 'Thư Viện Số — Tài nguyên cho Producer Việt',
  metaDescription: 'Download Sample Pack, FLP Project, VST Plugin & Preset miễn phí và premium cho Producer Việt',
  metaKeywords: 'fl studio, sample pack, vst plugin, flp project, preset, producer việt nam',
  heroTitle: 'Thư Viện Số Việt Nam',
  heroSubtitle: 'Download Sample Pack, FLP Project, VST Plugin & Preset chất lượng cao. Tài nguyên EDM, Vinahouse dành riêng cho Producer Việt.',
  heroBadge: '',
  announcementEnabled: false,
  announcementText: '',
  announcementLink: '',
  minTopup: MIN_TOPUP,
  maxDownloads: 5,
  downloadExpiryHours: 72,
  footerText: 'Tài nguyên FLP, VST, Sample Pack cho Producer Việt Nam. Download miễn phí và premium cho Producer Việt.',
  copyrightText: '',
}

/** Migrate stale localStorage values to current defaults */
function migrateSettings(stored: Partial<SiteSettings>): Partial<SiteSettings> {
  const migrations: Array<{ key: keyof SiteSettings; oldValues: string[]; newValue: string }> = [
    { key: 'siteName', oldValues: ['Thư Viện FL Studio', 'FL Studio'], newValue: defaultSiteSettings.siteName },
    { key: 'logoText', oldValues: ['Thư Viện FL Studio', 'FL Studio'], newValue: defaultSiteSettings.logoText },
    { key: 'contactEmail', oldValues: ['support@thuvienso'], newValue: defaultSiteSettings.contactEmail },
    { key: 'contactPhone', oldValues: ['0899 147 227'], newValue: defaultSiteSettings.contactPhone },
  ]
  const result = { ...stored }
  let changed = false
  for (const m of migrations) {
    const val = result[m.key]
    if (typeof val === 'string' && m.oldValues.some(old => val.includes(old))) {
      ;(result as Record<string, unknown>)[m.key] = m.newValue
      changed = true
    }
  }
  if (changed) {
    try { localStorage.setItem('admin_site_settings', JSON.stringify(result)) } catch {}
  }
  return result
}

/** Get current site settings (admin-configured or defaults) — safe for client & server */
export function getSiteSettings(): SiteSettings {
  if (typeof window === 'undefined') return defaultSiteSettings
  try {
    const raw = localStorage.getItem('admin_site_settings')
    if (!raw) return defaultSiteSettings
    const parsed = migrateSettings(JSON.parse(raw))
    return { ...defaultSiteSettings, ...parsed }
  } catch {
    return defaultSiteSettings
  }
}

/** Debounced DB sync — batches rapid saves into a single API call */
let _settingsDbTimer: ReturnType<typeof setTimeout> | null = null

function syncSettingsToDb(settings: SiteSettings) {
  if (_settingsDbTimer) clearTimeout(_settingsDbTimer)
  _settingsDbTimer = setTimeout(() => {
    fetch('/api/site-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ settings }),
    }).then(res => {
      if (!res.ok) console.warn('[SiteContent] DB save failed:', res.status)
    }).catch(() => {
      console.warn('[SiteContent] DB save failed: network error')
    })
  }, 1500)
}

/** Save site settings — localStorage instant, DB debounced */
export function saveSiteSettings(settings: SiteSettings) {
  try {
    localStorage.setItem('admin_site_settings', JSON.stringify(settings))
    window.dispatchEvent(new StorageEvent('storage', { key: 'admin_site_settings' }))
  } catch {}
  syncSettingsToDb(settings)
}
