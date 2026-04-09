import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Public health check — tests database connectivity.
 * Returns DB status, product count, and category count.
 * No auth required (read-only, no sensitive data exposed).
 */
export async function GET() {
  const start = Date.now()
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasPayloadSecret: !!process.env.PAYLOAD_SECRET,
      nodeEnv: process.env.NODE_ENV,
    },
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      ...result,
      status: 'error',
      error: 'DATABASE_URL is not set. Please configure it in Vercel Environment Variables.',
      ms: Date.now() - start,
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    result.initMs = Date.now() - start

    const [products, categories] = await Promise.all([
      payload.find({ collection: 'products', limit: 1, depth: 0 }),
      payload.find({ collection: 'categories', limit: 1, depth: 0 }),
    ])

    result.status = 'ok'
    result.productCount = products.totalDocs
    result.categoryCount = categories.totalDocs
    result.ms = Date.now() - start

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    result.status = 'error'
    result.error = (error as Error).message
    result.ms = Date.now() - start

    return NextResponse.json(result, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
