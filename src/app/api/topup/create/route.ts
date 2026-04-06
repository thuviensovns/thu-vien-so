import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'
import crypto from 'crypto'

/** Create a pending top-up request */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const amount = Number(body?.amount)
    if (!amount || amount < 10000 || amount > 100000000) {
      return NextResponse.json({ error: 'Invalid amount (min 10,000 VND)' }, { status: 400 })
    }

    // SECURITY: Always generate server-side transfer code (ignore client input to prevent collisions)
    let transferCode = `NAP${crypto.randomBytes(4).toString('hex').toUpperCase()}`

    // Check for duplicate transferCode
    const existing = await payload.find({
      collection: 'topups',
      where: { transferCode: { equals: transferCode } },
      limit: 1,
    })
    if (existing.totalDocs > 0) {
      // Generate a new server-side code
      transferCode = `NAP${crypto.randomBytes(4).toString('hex').toUpperCase()}`
      const existing2 = await payload.find({
        collection: 'topups',
        where: { transferCode: { equals: transferCode } },
        limit: 1,
      })
      if (existing2.totalDocs > 0) {
        return NextResponse.json({ error: 'Please try again' }, { status: 503 })
      }
    }

    // Create pending top-up with 30-minute expiry
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const topup = await payload.create({
      collection: 'topups',
      data: {
        user: user.id,
        amount,
        transferCode,
        status: 'pending',
        expiresAt,
      },
    })

    return NextResponse.json({
      id: topup.id,
      transferCode,
      amount,
      status: 'pending',
      expiresAt,
    })
  } catch (error) {
    console.error('[TopUp] Create error:', error)
    const msg = (error as Error).message
    if (msg === 'timeout' || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
