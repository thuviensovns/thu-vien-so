/**
 * Auto-generated Payload CMS types (manually created from collection schemas)
 * Matches all collections and globals defined in payload.config.ts
 */

// ─── Base types ───────────────────────────────────────────────
export interface PayloadBase {
  id: number
  createdAt: string
  updatedAt: string
}

// ─── Media ────────────────────────────────────────────────────
export interface Media extends PayloadBase {
  alt?: string | null
  url?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  sizes?: {
    thumbnail?: MediaSize | null
    card?: MediaSize | null
    hero?: MediaSize | null
  }
}

export interface MediaSize {
  url?: string | null
  width?: number | null
  height?: number | null
  filename?: string | null
  filesize?: number | null
  mimeType?: string | null
}

// ─── Users ────────────────────────────────────────────────────
export type UserRole = 'admin' | 'customer'

export interface User extends PayloadBase {
  email: string
  displayName?: string | null
  phone?: string | null
  role: UserRole
  avatar?: number | Media | null
  balance?: number | null
}

// ─── Categories ───────────────────────────────────────────────
export type ProductType = 'sample-pack' | 'flp' | 'vst' | 'preset' | 'instrument' | 'song-nhac-lyrics'

export interface Category extends PayloadBase {
  name: string
  slug: string
  description?: string | null
  image?: number | Media | null
  type: ProductType
  parent?: number | Category | null
  order?: number | null
}

// ─── Products ─────────────────────────────────────────────────
export type DawType = 'fl-studio' | 'ableton' | 'logic-pro' | 'all'

export interface Product extends PayloadBase {
  name: string
  slug: string
  description?: unknown // richText
  type: ProductType
  category: number | Category
  pricing: {
    price: number
    originalPrice?: number | null
    isFree?: boolean | null
  }
  file?: {
    downloadUrl?: string | null
    r2Key?: string | null
    fileName?: string | null
    fileSize?: number | null
    fileFormat?: string | null
  } | null
  preview?: {
    audioFile?: number | Media | null
    bpm?: number | null
    musicalKey?: string | null
    duration?: number | null
  } | null
  video?: {
    url?: string | null
    r2Key?: string | null
    fileName?: string | null
    fileSize?: number | null
    mimeType?: string | null
  } | null
  thumbnail?: number | Media | null
  thumbnailUrl?: string | null
  gallery?: Array<{ image?: number | Media | null; id?: string }> | null
  compatibility?: Array<{ daw?: DawType | null; version?: string | null; id?: string }> | null
  tags?: Array<{ tag?: string | null; id?: string }> | null
  downloadCount?: number | null
  featured?: boolean | null
  order?: number | null
}

// ─── Orders ───────────────────────────────────────────────────
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type PaymentMethod = 'vnpay' | 'momo' | 'zalopay' | 'bank-transfer' | 'balance'

export interface OrderItem {
  product: number | Product
  price: number
  productName?: string | null
  id?: string
}

export interface Order extends PayloadBase {
  orderNumber: string
  user: number | User
  items: OrderItem[]
  total: number
  status: OrderStatus
  payment?: {
    method?: PaymentMethod | null
    transactionId?: string | null
    paidAt?: string | null
    rawResponse?: unknown
  } | null
  customerEmail?: string | null
  customerPhone?: string | null
  note?: string | null
  downloadToken?: string | null
  downloadExpiresAt?: string | null
}

// ─── Downloads ────────────────────────────────────────────────
export interface DownloadLogEntry {
  downloadedAt?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  id?: string
}

export interface Download extends PayloadBase {
  user: number | User
  order: number | Order
  product: number | Product
  downloadCount?: number | null
  maxDownloads?: number | null
  lastDownloadedAt?: string | null
  expiresAt?: string | null
  downloadLog?: DownloadLogEntry[] | null
}

// ─── TopUps ───────────────────────────────────────────────────
export type TopUpStatus = 'pending' | 'completed' | 'failed' | 'expired'

export interface TopUp extends PayloadBase {
  user: number | User
  amount: number
  transferCode: string
  status: TopUpStatus
  bankTransactionId?: string | null
  bankDescription?: string | null
  confirmedAt?: string | null
  readByAdmin?: boolean | null
  expiresAt?: string | null
}

// ─── Blog Posts ───────────────────────────────────────────────
export type BlogCategory = 'tutorial' | 'tips' | 'news' | 'review'

export interface BlogPost extends PayloadBase {
  title: string
  slug: string
  excerpt?: string | null
  content?: unknown // richText
  featuredImage?: number | Media | null
  author?: number | User | null
  blogCategory?: BlogCategory | null
  tags?: Array<{ tag?: string | null; id?: string }> | null
  publishedAt?: string | null
  seo?: {
    metaTitle?: string | null
    metaDescription?: string | null
    ogImage?: number | Media | null
  } | null
}

// ─── Contact Messages ─────────────────────────────────────────
export type ContactStatus = 'new' | 'processing' | 'replied' | 'closed'

export interface ContactMessage extends PayloadBase {
  name: string
  email: string
  subject: string
  message: string
  status?: ContactStatus | null
  adminNote?: string | null
  ipAddress?: string | null
}

// ─── Globals ──────────────────────────────────────────────────
export interface BankConfig {
  bankBin: string
  bankName: string
  accountNumber: string
  accountName: string
}

export interface SiteContent {
  settings?: Record<string, unknown> | null
  categoryDescriptions?: Record<string, string> | null
}

// ─── Payload Find Response ────────────────────────────────────
export interface PaginatedDocs<T> {
  docs: T[]
  totalDocs: number
  totalPages: number
  page?: number
  limit?: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage?: number | null
  nextPage?: number | null
  pagingCounter: number
}
