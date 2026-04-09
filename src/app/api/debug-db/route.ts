import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Debug endpoint — requires admin auth or REVALIDATE_SECRET */
export async function GET(req: NextRequest) {
  // Security: require secret or admin auth
  const secret = process.env.REVALIDATE_SECRET
  const headerSecret = req.headers.get('x-debug-secret') || req.nextUrl.searchParams.get('secret')
  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasPayloadSecret: !!process.env.PAYLOAD_SECRET,
      nodeEnv: process.env.NODE_ENV,
    },
  }

  try {
    const startInit = Date.now()
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    results.payloadInitMs = Date.now() - startInit

    // Count products
    const startQuery = Date.now()
    const products = await payload.find({
      collection: 'products',
      limit: 5,
      depth: 0,
    })
    results.queryMs = Date.now() - startQuery
    results.products = {
      totalDocs: products.totalDocs,
      totalPages: products.totalPages,
      sampleIds: products.docs.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
    }

    // Count categories
    const categories = await payload.find({
      collection: 'categories',
      limit: 100,
      depth: 0,
    })
    results.categories = {
      totalDocs: categories.totalDocs,
      docs: categories.docs.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
    }

    results.status = 'ok'
  } catch (error) {
    results.status = 'error'
    results.error = (error as Error).message
    results.stack = (error as Error).stack?.split('\n').slice(0, 5)
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
