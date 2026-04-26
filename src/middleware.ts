import { NextRequest, NextResponse } from 'next/server'
import { isRateLimited, cleanupStaleEntries } from '@/lib/rate-limit'

// --- CSP ---
// Single source of truth for Content-Security-Policy. Applied uniformly to
// every page + custom API route; Payload admin (`/admin/*`) is skipped because
// it ships its own inline bootstrap.
//
// Legend:
//   self         — same-origin
//   data:        — small inline resources (fonts, tiny images)
//   blob:        — URL.createObjectURL() previews, client-generated files
//   *.r2.*       — Cloudflare R2 (product files, demos, thumbnails)
//   *.blob.v-s.c — legacy Vercel Blob URLs already in DB (read-only)
//   img.vietqr.io — bank transfer QR
//   *.supabase.co — legacy media
//   *.ngrok/*.trycloudflare — YouTube-downloader home-PC proxy
//   www.youtube/player.vimeo — video embeds
//   cdn.jsdelivr/huggingface — AI vocal-remover page only
function buildCsp(opts: { isDev: boolean; isAIToolPage: boolean }): string {
  const { isDev, isAIToolPage } = opts

  const scriptSrc = ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"]
  if (isDev) scriptSrc.push("'unsafe-eval'")
  if (isAIToolPage) scriptSrc.push('https://cdn.jsdelivr.net', 'blob:')

  const imgSrc = [
    "'self'", 'data:', 'blob:',
    'https://img.vietqr.io',
    'https://*.supabase.co',
    'https://*.r2.cloudflarestorage.com', 'https://*.r2.dev',
    'https://*.public.blob.vercel-storage.com',
    'https://i.ytimg.com',
  ]

  const connectSrc = [
    "'self'",
    // R2 presigned PUT — browser uploads bytes directly to the bucket.
    'https://*.r2.cloudflarestorage.com', 'https://*.r2.dev',
    // Media fetches (WaveSurfer pre-loads audio, Next/Image, etc.)
    'https://*.supabase.co',
    // Legacy Vercel Blob URLs still referenced from product records.
    'https://*.public.blob.vercel-storage.com',
    // Bank QR + home-PC YouTube proxy
    'https://img.vietqr.io',
    'https://*.ngrok-free.dev', 'https://*.ngrok-free.app',
    'https://*.trycloudflare.com',
  ]
  if (isAIToolPage) {
    connectSrc.push('https://cdn.jsdelivr.net', 'https://huggingface.co', 'https://*.hf.co')
  }

  const mediaSrc = [
    "'self'", 'blob:',
    'https://*.r2.cloudflarestorage.com', 'https://*.r2.dev',
    'https://*.public.blob.vercel-storage.com',
  ]

  const frameSrc = [
    "'self'",
    'https://www.youtube.com',
    'https://player.vimeo.com',
  ]

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    `media-src ${mediaSrc.join(' ')}`,
    `worker-src 'self'${isAIToolPage ? ' blob:' : ''}`,
    `frame-src ${frameSrc.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

// --- Middleware ---
// Wrapped: any uncaught edge-runtime error here was surfacing to the client as
// a generic 500 with empty logs (observed on POST /api/topup/create). Catching
// lets the route handler run and emits the real error so we can diagnose.
export function middleware(req: NextRequest): NextResponse {
  try {
    return runMiddleware(req)
  } catch (err) {
    console.error('[middleware] crashed:', (err as Error)?.stack || err)
    return NextResponse.next()
  }
}

function runMiddleware(req: NextRequest): NextResponse {
  const res = NextResponse.next()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const pathname = req.nextUrl.pathname
  const isApi = pathname.startsWith('/api/')

  // Skip middleware entirely for file-upload routes. Middleware's client body
  // limit (1MB default in Next.js 15) silently truncates larger bodies, which
  // causes req.formData() in the route handler to hang on MP3/MP4 uploads.
  if (pathname.startsWith('/api/upload/')) return NextResponse.next()

  cleanupStaleEntries()

  // Skip ALL middleware processing for Payload REST API routes
  // These are handled by Payload's own auth/CORS — middleware headers interfere
  const isPayloadApi = isApi && !pathname.startsWith('/api/revalidate')
    && !pathname.startsWith('/api/contact')
    && !pathname.startsWith('/api/download')
    && !pathname.startsWith('/api/payment')
    && !pathname.startsWith('/api/upload')
    && !pathname.startsWith('/api/site-content')
    && !pathname.startsWith('/api/balance')
    && !pathname.startsWith('/api/topup')
    && !pathname.startsWith('/api/notifications')
    && !pathname.startsWith('/api/admin')
    && !pathname.startsWith('/api/my-messages')
    && !pathname.startsWith('/api/messages')
    && !pathname.startsWith('/api/bank-config')
    && !pathname.startsWith('/api/setup')
    && !pathname.startsWith('/api/orders')
    && !pathname.startsWith('/api/debug-db')
    && !pathname.startsWith('/api/health')
    && !pathname.startsWith('/api/ping')
    && !pathname.startsWith('/api/vocal-remover')
  if (isPayloadApi) return NextResponse.next()

  // Rate limit custom API routes
  if (pathname.startsWith('/api/contact')) {
    if (isRateLimited(`contact:${ip}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
  } else if (pathname.startsWith('/api/download')) {
    if (isRateLimited(`dl:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many download requests.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
  } else if (pathname.startsWith('/api/payment')) {
    if (isRateLimited(`pay:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many payment requests.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
  } else if (pathname.startsWith('/api/revalidate')) {
    if (isRateLimited(`reval:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many revalidation requests.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
  } else if (pathname.startsWith('/api/topup')) {
    // /nap-tien fires /api/topup/ping every 5s (12/min) + /api/topup/status
    // every 5s (12/min) while the QR is visible. Limit needs headroom above
    // ~24/min per IP. Raised from 10/60s → 120/60s (2/s). Per-endpoint ping
    // has its own stricter in-handler limiter (10/10s).
    if (isRateLimited(`topup:${ip}`, 120, 60_000)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
  } else if (isApi) {
    if (isRateLimited(ip, 60)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
  }

  // Auth endpoint rate limit
  if (pathname.includes('/login') || pathname.includes('/register')) {
    if (isRateLimited(`auth:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many authentication attempts.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
  }

  // --- Security Headers (frontend pages + custom API routes only) ---
  // Skip for Payload admin UI
  if (pathname.startsWith('/admin')) return res

  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)')
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  // CSP — centralized in buildCsp() for a single source of truth
  const isDev = process.env.NODE_ENV !== 'production'
  const isAIToolPage = pathname.startsWith('/cong-cu/xoa-giong-ai')
  res.headers.set('Content-Security-Policy', buildCsp({ isDev, isAIToolPage }))

  // Cross-Origin policies — only for page routes, not API
  if (!isApi) {
    res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    res.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
    // Enable SharedArrayBuffer for ONNX Runtime WASM (AI vocal separator)
    if (isAIToolPage) {
      res.headers.set('Cross-Origin-Embedder-Policy', 'credentialless')
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|admin).*)',
  ],
}
