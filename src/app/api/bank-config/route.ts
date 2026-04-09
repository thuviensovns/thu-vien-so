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

    const bankConfig = await payload.findGlobal({ slug: 'bank-config' }) as { bankBin?: string; bankName?: string; accountNumber?: string; accountName?: string }

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
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { bankBin?: string; bankName?: string; accountNumber?: string; accountName?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { bankBin, bankName, accountNumber, accountName } = body

    // Validate required fields exist and are strings
    if (!bankBin || !bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (typeof bankBin !== 'string' || typeof bankName !== 'string'
      || typeof accountNumber !== 'string' || typeof accountName !== 'string') {
      return NextResponse.json({ error: 'Invalid field types' }, { status: 400 })
    }

    // Validate field lengths and format
    if (bankBin.length > 20 || bankName.length > 100
      || accountNumber.length > 30 || accountName.length > 100) {
      return NextResponse.json({ error: 'Field value too long' }, { status: 400 })
    }
    if (!/^\d+$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Account number must contain only digits' }, { status: 400 })
    }
    if (/[<>"';]/.test(bankBin + bankName + accountName)) {
      return NextResponse.json({ error: 'Invalid characters detected' }, { status: 400 })
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
