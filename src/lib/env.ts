/**
 * Environment variable validation — fail fast on missing critical vars.
 * Import this in server-side code to get typed, validated env values.
 */

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

function optionalEnv(key: string, fallback = ''): string {
  return process.env[key] || fallback
}

/** Validated environment variables — server-side only */
export const env = {
  // Required
  DATABASE_URL: requireEnv('DATABASE_URL'),
  PAYLOAD_SECRET: requireEnv('PAYLOAD_SECRET'),

  // Site
  NEXT_PUBLIC_SITE_URL: optionalEnv('NEXT_PUBLIC_SITE_URL', 'https://thuvienso.top'),

  // R2 Storage (optional — graceful degradation if missing)
  R2_ENDPOINT: optionalEnv('R2_ENDPOINT'),
  R2_ACCESS_KEY_ID: optionalEnv('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: optionalEnv('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME: optionalEnv('R2_BUCKET_NAME'),
  R2_PUBLIC_URL: optionalEnv('R2_PUBLIC_URL'),

  // VNPay (optional)
  VNPAY_TMN_CODE: optionalEnv('VNPAY_TMN_CODE'),
  VNPAY_HASH_SECRET: optionalEnv('VNPAY_HASH_SECRET'),
  VNPAY_URL: optionalEnv('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),

  // Webhooks
  SEPAY_WEBHOOK_KEY: optionalEnv('SEPAY_WEBHOOK_KEY'),
  REVALIDATE_SECRET: optionalEnv('REVALIDATE_SECRET'),

  // Admin setup
  INITIAL_ADMIN_EMAIL: optionalEnv('INITIAL_ADMIN_EMAIL'),
  INITIAL_ADMIN_PASSWORD: optionalEnv('INITIAL_ADMIN_PASSWORD'),
} as const
