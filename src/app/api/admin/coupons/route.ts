import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** GET: List all coupons */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const coupons = await payload.find({
      collection: 'coupons',
      sort: '-createdAt',
      limit: 200,
      overrideAccess: true,
    })

    return NextResponse.json({ docs: coupons.docs })
  } catch (error) {
    console.error('[Admin coupons] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** POST: Create a new coupon */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { code?: string; type?: string; value?: number; minOrder?: number; maxUses?: number; expiresAt?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (!body.code?.trim()) {
      return NextResponse.json({ error: 'Mã giảm giá là bắt buộc' }, { status: 400 })
    }

    const coupon = await payload.create({
      collection: 'coupons',
      data: {
        code: body.code.toUpperCase().trim(),
        type: (body.type as 'percent' | 'fixed') || 'percent',
        value: body.value || 0,
        minOrder: body.minOrder || 0,
        maxUses: body.maxUses || 0,
        active: true,
        expiresAt: body.expiresAt || undefined,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ success: true, coupon })
  } catch (error) {
    console.error('[Admin coupons] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** PATCH: Toggle coupon active state */
export async function PATCH(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { id?: number; active?: boolean }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (!body.id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    await payload.update({
      collection: 'coupons',
      id: body.id,
      data: { active: body.active ?? false },
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin coupons] PATCH error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** DELETE: Delete a coupon */
export async function DELETE(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    await payload.delete({
      collection: 'coupons',
      id: Number(id),
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin coupons] DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
