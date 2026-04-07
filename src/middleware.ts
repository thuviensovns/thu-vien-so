import { NextRequest, NextResponse } from 'next/server'

// --- Rate limiting (in-memory, per IP) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > limit
}

// Clean up stale entries inline during rate limit checks
function cleanupStaleEntries() {
  const now = Date.now()
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap) {
      if (now > value.resetAt) rateLimitMap.delete(key)
    }
  }
}

// --- Middleware ---
export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const isApi = req.nextUrl.pathname.startsWith('/api/')

  // Clean up stale rate limit entries
  cleanupStaleEntries()

  // Rate limit API routes (60 req/min per IP) — skip routes with their own stricter limits
  const hasStricterLimit = req.nextUrl.pathname.startsWith('/api/contact')
    || req.nextUrl.pathname.startsWith('/api/download')
    || req.nextUrl.pathname.startsWith('/api/payment')
  if (isApi && !hasStricterLimit) {
    if (isRateLimited(ip, 60)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // Stricter rate limit for auth endpoints (10 req/min per IP)
  if (req.nextUrl.pathname.includes('/login') || req.nextUrl.pathname.includes('/register')) {
    if (isRateLimited(`auth:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { error: 'Too many authentication attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // Stricter rate limit for download endpoints (20 req/min per IP)
  if (req.nextUrl.pathname.startsWith('/api/download')) {
    if (isRateLimited(`dl:${ip}`, 20, 60_000)) {
      return NextResponse.json(
        { error: 'Too many download requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // Stricter rate limit for contact endpoint (5 req/min per IP)
  if (req.nextUrl.pathname.startsWith('/api/contact')) {
    if (isRateLimited(`contact:${ip}`, 5, 60_000)) {
      return NextResponse.json(
        { error: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // Stricter rate limit for payment endpoints (10 req/min per IP)
  if (req.nextUrl.pathname.startsWith('/api/payment')) {
    if (isRateLimited(`pay:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { error: 'Too many payment requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // Strict rate limit for revalidate endpoint (5 req/min per IP)
  if (req.nextUrl.pathname.startsWith('/api/revalidate')) {
    if (isRateLimited(`reval:${ip}`, 5, 60_000)) {
      return NextResponse.json(
        { error: 'Too many revalidation requests.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // Rate limit for topup endpoints (10 req/min per IP)
  if (req.nextUrl.pathname.startsWith('/api/topup')) {
    if (isRateLimited(`topup:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // --- Security Headers ---
  // Skip security headers for Payload admin — it manages its own security
  const isAdmin = req.nextUrl.pathname.startsWith('/admin')
  if (isAdmin) return res

  // Prevent clickjacking
  res.headers.set('X-Frame-Options', 'DENY')

  // Prevent MIME type sniffing
  res.headers.set('X-Content-Type-Options', 'nosniff')

  // XSS protection (legacy browsers)
  res.headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer policy — don't leak full URL to third parties
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions policy — restrict sensitive APIs
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  )

  // Strict transport security (HTTPS only, 1 year, include subdomains)
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )

  // Content Security Policy
  // 'unsafe-eval' required by Next.js Turbopack in dev; removed in production for security
  const isDev = process.env.NODE_ENV !== 'production'
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://img.vietqr.io https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://img.vietqr.io https://*.supabase.co",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(process.env.NODE_ENV === 'production' ? ["upgrade-insecure-requests"] : []),
    ].join('; ')
  )

  // Cross-Origin policies
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  return res
}

export const config = {
  matcher: [
    // Apply to all routes except static files, Next.js internals, and Payload admin
    '/((?!_next/static|_next/image|favicon.ico|images/|admin).*)',
  ],
}
