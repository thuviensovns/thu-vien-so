import crypto from 'crypto'

interface VNPayParams {
  orderId: string
  amount: number // VND
  orderInfo: string
  returnUrl: string
  ipAddr: string
}

function formatVNPayDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}${m}${d}${h}${min}${s}`
}

export function createVNPayUrl(params: VNPayParams): string {
  const tmnCode = process.env.VNPAY_TMN_CODE!
  const hashSecret = process.env.VNPAY_HASH_SECRET!
  const vnpUrl = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'

  const vnpParams: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(params.amount * 100),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: params.orderId,
    vnp_OrderInfo: params.orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: params.returnUrl,
    vnp_IpAddr: params.ipAddr,
    vnp_CreateDate: formatVNPayDate(new Date()),
  }

  // Sort params alphabetically
  const sortedKeys = Object.keys(vnpParams).sort()
  const signData = sortedKeys.map((k) => `${k}=${vnpParams[k]}`).join('&')

  // Create HMAC SHA512
  const hmac = crypto.createHmac('sha512', hashSecret)
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')
  vnpParams.vnp_SecureHash = signed

  const queryString = sortedKeys
    .concat('vnp_SecureHash')
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(vnpParams[k])}`)
    .join('&')

  return `${vnpUrl}?${queryString}`
}

export function verifyVNPaySignature(
  params: Record<string, string>,
): boolean {
  const hashSecret = process.env.VNPAY_HASH_SECRET!
  const secureHash = params.vnp_SecureHash

  if (!secureHash) return false

  const verifyParams = { ...params }
  delete verifyParams.vnp_SecureHash
  delete verifyParams.vnp_SecureHashType

  const sortedKeys = Object.keys(verifyParams).sort()
  const signData = sortedKeys
    .map((k) => `${k}=${verifyParams[k]}`)
    .join('&')

  const hmac = crypto.createHmac('sha512', hashSecret)
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')

  // Timing-safe comparison to prevent timing attacks
  if (signed.length !== secureHash.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(signed, 'hex'), Buffer.from(secureHash, 'hex'))
  } catch {
    return false
  }
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `MUS-${timestamp}-${random}`
}
