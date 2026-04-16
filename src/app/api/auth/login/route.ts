import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { getClientIp } from '@/lib/request-meta'
import { isIpBlocked, recordFailedAttempt, clearFailedAttempts } from '@/lib/ip-security'

/** Bound a promise by time so the login handler can't hang forever on a cold
 *  DB / stalled Payload init. If we miss the deadline, we surface a 504 so the
 *  client gets a toast immediately instead of a frozen spinner. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout:${label}`)), ms),
    ),
  ])
}

/** POST /api/auth/login
 *  Wraps Payload's login with IP-block + failed-attempt tracking.
 *  On success: sets the payload-token cookie and clears failed attempts.
 *  On failure: records a failed attempt — threshold triggers auto-block.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''
  const ip = getClientIp(req)

  if (!email || !password) {
    return NextResponse.json({ message: 'Email và mật khẩu là bắt buộc' }, { status: 400 })
  }

  // 1. Check IP block first
  const blockStatus = await isIpBlocked(ip)
  if (blockStatus.blocked) {
    return NextResponse.json(
      {
        message: 'IP của bạn đã bị chặn do quá nhiều lần đăng nhập thất bại. Vui lòng liên hệ quản trị viên.',
        reason: blockStatus.reason,
        until: blockStatus.until,
      },
      { status: 403 },
    )
  }

  // 2. Attempt login via Payload (bounded — cold Payload init + bcrypt can be
  //    slow; 12s is enough for any legitimate login but cuts off true hangs).
  try {
    const payload = await getPayloadForApi()
    const result = await withTimeout(
      payload.login({ collection: 'users', data: { email, password } }),
      12_000,
      'payload.login',
    )

    // Success — clear failed attempts, set cookie, return user
    await clearFailedAttempts(ip)

    const response = NextResponse.json({
      user: result.user,
      token: result.token,
      exp: result.exp,
    })

    if (result.token) {
      const maxAge = result.exp
        ? Math.max(0, result.exp - Math.floor(Date.now() / 1000))
        : 60 * 60 * 24 * 7
      response.cookies.set('payload-token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge,
      })
    }
    return response
  } catch (err) {
    const msg = (err as Error).message || ''
    const isTimeout = msg.startsWith('timeout:')
    const isAuthError = !isTimeout && /invalid|credentials|locked|password|email/i.test(msg)
    const status = isTimeout ? 504 : isAuthError ? 401 : 500

    // Record failed attempt (only for auth errors — not server errors)
    if (isAuthError) {
      const { attempts, blocked } = await recordFailedAttempt(req, {
        email,
        type: 'login',
        reason: msg.slice(0, 200),
      })
      if (blocked) {
        return NextResponse.json(
          {
            message: 'IP của bạn đã bị chặn tạm thời do quá nhiều lần đăng nhập sai.',
            attempts,
          },
          { status: 403 },
        )
      }
    }

    return NextResponse.json(
      {
        message: isTimeout
          ? 'Máy chủ phản hồi chậm. Vui lòng thử lại sau ít giây.'
          : isAuthError
            ? 'Email hoặc mật khẩu không đúng'
            : 'Lỗi server',
      },
      { status },
    )
  }
}
