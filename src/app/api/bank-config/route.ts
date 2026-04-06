import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import { defaultBankAccount } from '@/lib/config'

/** GET: Returns bank account info for QR generation (requires auth for full details) */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    // Check if user is authenticated
    let isAuthenticated = false
    try {
      const { user } = await payload.auth({ headers: req.headers })
      isAuthenticated = !!user
    } catch { /* not authenticated */ }

    // Only authenticated users can see full bank details (needed for QR transfer)
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập để xem thông tin chuyển khoản' }, { status: 401 })
    }

    const bankConfig = await payload.findGlobal({ slug: 'bank-config' }) as any

    if (bankConfig?.accountNumber) {
      return NextResponse.json({
        bankBin: bankConfig.bankBin || defaultBankAccount.bankBin,
        bankName: bankConfig.bankName || defaultBankAccount.bankName,
        accountNumber: bankConfig.accountNumber,
        accountName: bankConfig.accountName || defaultBankAccount.accountName,
      })
    }

    return NextResponse.json(defaultBankAccount)
  } catch {
    // Fallback to hardcoded defaults if DB unavailable
    return NextResponse.json(defaultBankAccount)
  }
}

/** POST: Admin-only - update bank config */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { bankBin, bankName, accountNumber, accountName } = body
    if (!bankBin || !bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await payload.updateGlobal({
      slug: 'bank-config',
      data: { bankBin, bankName, accountNumber, accountName },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[BankConfig] Update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
