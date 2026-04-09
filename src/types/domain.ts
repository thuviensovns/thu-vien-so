/**
 * Domain types for API requests, responses, and business logic.
 * Re-exports commonly used Payload types for convenience.
 */
export type {
  Product, Order, User, Category, TopUp, BlogPost, Download,
  Media, ContactMessage, OrderItem, BankConfig, SiteContent,
  ProductType, OrderStatus, PaymentMethod, TopUpStatus, DawType,
  PaginatedDocs,
} from './payload-types'

// ─── API Request Bodies ───────────────────────────────────────

export interface CreateOrderRequest {
  items: Array<{ productId: string | number }>
  paymentMethod: 'vnpay' | 'bank-transfer' | 'momo' | 'balance'
  customerEmail?: string
  customerPhone?: string
}

export interface PayWithBalanceRequest {
  orderId: string | number
}

export interface CreateTopUpRequest {
  amount: number
}

export interface ContactFormRequest {
  name: string
  email: string
  subject?: string
  message: string
}

// ─── Webhook Bodies ───────────────────────────────────────────

export interface SepayWebhookBody {
  id: number | string
  transferType: 'in' | 'out'
  transferAmount: number
  referenceCode?: string
  content?: string
  description?: string
  gateway?: string
  transactionDate?: string
}

export interface VNPayReturnParams {
  vnp_TxnRef: string
  vnp_Amount: string
  vnp_ResponseCode: string
  vnp_TransactionStatus: string
  vnp_SecureHash: string
  vnp_TransactionNo?: string
  vnp_PayDate?: string
  [key: string]: string | undefined
}

// ─── API Responses ────────────────────────────────────────────

export interface ApiError {
  error: string
  details?: string
}

export interface FulfillResult {
  orderNumber: string
  downloadToken: string
  downloadExpiresAt: string
  items: Array<{ productId: number | string; productName: string }>
}

// ─── Product Display (frontend) ───────────────────────────────

export interface ProductDisplay {
  id: string
  name: string
  slug: string
  type: string
  thumbnail: { url: string }
  thumbnailUrl?: string
  pricing: {
    price: number
    originalPrice?: number | null
    isFree?: boolean
  }
  preview?: {
    bpm?: number | null
    musicalKey?: string | null
    audioFile?: { url: string } | null
    duration?: number | null
  }
  downloadCount: number
  featured?: boolean
  category?: { slug: string; name: string }
  file?: {
    r2Key?: string | null
    fileName?: string | null
    fileSize?: number | null
    fileFormat?: string | null
    downloadUrl?: string | null
  }
  compatibility?: Array<{ daw?: string; version?: string }>
  tags?: Array<{ tag?: string }>
  updatedAt: string
  isCustom?: boolean
}

// ─── Site Stats ───────────────────────────────────────────────

export interface SiteStats {
  totalProducts: number
  freeProducts: number
  totalUsers: number
  totalDownloads: number
}
