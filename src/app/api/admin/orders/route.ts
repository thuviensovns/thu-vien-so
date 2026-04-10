import { NextRequest, NextResponse } from 'next/server'
import { getPayloadForApi } from '@/lib/payload'

/** GET: List orders for admin management page */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const search = req.nextUrl.searchParams.get('search') || ''
    const status = req.nextUrl.searchParams.get('status') || ''
    const page = Number(req.nextUrl.searchParams.get('page')) || 1
    const sort = req.nextUrl.searchParams.get('sort') || '-createdAt'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (search) {
      where.or = [
        { orderNumber: { contains: search } },
        { customerEmail: { contains: search } },
      ]
    }
    if (status && status !== 'all') {
      where.status = { equals: status }
    }

    const orders = await payload.find({
      collection: 'orders',
      where,
      sort,
      limit: 20,
      page,
      depth: 1,
      overrideAccess: true,
    })

    return NextResponse.json({
      docs: orders.docs.map((o) => {
        const u = typeof o.user === 'object' && o.user ? o.user : null
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          email: o.customerEmail || (u as Record<string, unknown>)?.email || 'Unknown',
          total: o.total,
          status: o.status,
          method: o.payment?.method || 'balance',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: (o.items || []).map((item: any) => ({
            name: item.productName || (typeof item.product === 'object' && item.product ? item.product.name : 'Sản phẩm'),
            price: item.price,
          })),
          createdAt: o.createdAt,
        }
      }),
      totalDocs: orders.totalDocs,
      totalPages: orders.totalPages,
      page: orders.page,
    })
  } catch (error) {
    console.error('[Admin orders] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** PATCH: Update order status */
export async function PATCH(req: NextRequest) {
  try {
    const payload = await getPayloadForApi()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { id?: number; status?: string }
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (!body.id || !body.status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
    }

    const validStatuses = ['pending', 'paid', 'failed', 'refunded']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { status: body.status }
    if (body.status === 'paid') {
      data['payment.paidAt'] = new Date().toISOString()
    }

    await payload.update({
      collection: 'orders',
      id: body.id,
      data,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin orders] PATCH error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
