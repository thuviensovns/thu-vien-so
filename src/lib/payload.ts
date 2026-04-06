import type { Where } from 'payload'
import { unstable_noStore as noStore } from 'next/cache'

const emptyResult = { docs: [] as unknown[], totalDocs: 0, totalPages: 0, page: 1 }

const PAYLOAD_TIMEOUT_MS = 5000 // Allow time for initial Payload CMS connection

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Payload init timeout (${ms}ms)`)), ms)
    ),
  ])
}

// Cache: undefined = not tried, null = tried and failed, object = success
let _cachedPayload: Awaited<ReturnType<typeof import('payload')['getPayload']>> | null | undefined = undefined
let _cacheExpiry = 0

async function safeGetPayload() {
  // Return cached result if available (cache failure for 30s, success indefinitely)
  const now = Date.now()
  if (_cachedPayload !== undefined) {
    if (_cachedPayload === null && now < _cacheExpiry) return null
    if (_cachedPayload !== null) return _cachedPayload
  }

  try {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const instance = await withTimeout(getPayload({ config }), PAYLOAD_TIMEOUT_MS)
    _cachedPayload = instance
    return instance
  } catch (error) {
    console.error('[Payload] Failed to initialize:', (error as Error).message)
    _cachedPayload = null
    _cacheExpiry = now + 30_000 // Retry after 30 seconds
    return null
  }
}

export async function getPayloadClient() {
  return safeGetPayload()
}

/**
 * Get Payload instance for API routes — throws on timeout.
 * Use this in API route handlers instead of raw getPayload + Promise.race.
 */
export async function getPayloadForApi(timeoutMs = 5000) {
  const { getPayload } = await import('payload')
  const config = (await import('@payload-config')).default
  return withTimeout(getPayload({ config }), timeoutMs)
}

export async function getProducts(opts: {
  category?: string
  type?: string
  page?: number
  limit?: number
  sort?: string
  search?: string
  isFree?: boolean
}) {
  noStore() // Prevent Next.js from caching this query
  const payload = await safeGetPayload()
  if (!payload) return emptyResult

  try {
    const conditions: Where[] = []
    if (opts.category) conditions.push({ 'category.slug': { equals: opts.category } })
    if (opts.type) conditions.push({ type: { equals: opts.type } })
    if (opts.isFree === true) conditions.push({ 'pricing.isFree': { equals: true } })
    if (opts.isFree === false) conditions.push({ 'pricing.isFree': { equals: false } })
    if (opts.search) conditions.push({ name: { like: opts.search } })

    const where: Where = conditions.length > 0 ? { and: conditions } : {}

    return await payload.find({
      collection: 'products',
      where,
      page: opts.page || 1,
      limit: opts.limit || 12,
      sort: opts.sort || '-createdAt',
      depth: 2,
    })
  } catch (error) {
    console.error('[Payload] getProducts error:', (error as Error).message)
    return emptyResult
  }
}

export async function getProductBySlug(slug: string) {
  noStore()
  const payload = await safeGetPayload()
  if (!payload) return null

  try {
    const result = await payload.find({
      collection: 'products',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
    })
    return result.docs[0] || null
  } catch (error) {
    console.error('[Payload] getProductBySlug error:', (error as Error).message)
    return null
  }
}

export async function getCategories() {
  noStore()
  const payload = await safeGetPayload()
  if (!payload) return emptyResult

  try {
    return await payload.find({
      collection: 'categories',
      sort: 'order',
      limit: 100,
    })
  } catch (error) {
    console.error('[Payload] getCategories error:', (error as Error).message)
    return emptyResult
  }
}

export async function getCategoryBySlug(slug: string) {
  noStore()
  const payload = await safeGetPayload()
  if (!payload) return null

  try {
    const result = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
    })
    return result.docs[0] || null
  } catch (error) {
    console.error('[Payload] getCategoryBySlug error:', (error as Error).message)
    return null
  }
}

export async function getBlogPosts(opts?: {
  page?: number
  limit?: number
  category?: string
}) {
  noStore()
  const payload = await safeGetPayload()
  if (!payload) return emptyResult

  try {
    const conditions: Where[] = [{ _status: { equals: 'published' } }]
    if (opts?.category) conditions.push({ blogCategory: { equals: opts.category } })
    const where: Where = { and: conditions }

    return await payload.find({
      collection: 'blog-posts',
      where,
      page: opts?.page || 1,
      limit: opts?.limit || 10,
      sort: '-publishedAt',
      depth: 2,
    })
  } catch (error) {
    console.error('[Payload] getBlogPosts error:', (error as Error).message)
    return emptyResult
  }
}

/** Get site-wide stats: total products, free products, total downloads, total users */
export async function getSiteStats() {
  noStore()
  const payload = await safeGetPayload()
  if (!payload) return null

  try {
    const [allDocs, freeProducts, users] = await Promise.all([
      payload.find({ collection: 'products', limit: 1000, depth: 0 }),
      payload.find({ collection: 'products', where: { 'pricing.isFree': { equals: true } }, limit: 0, depth: 0 }),
      payload.find({ collection: 'users', limit: 0, depth: 0 }),
    ])

    // Sum download counts from loaded products
    const totalDownloads = allDocs.docs.reduce((sum, doc) => {
      const product = doc as unknown as { downloadCount?: number }
      return sum + (product.downloadCount || 0)
    }, 0)

    if (allDocs.totalDocs > allDocs.docs.length) {
      console.warn(`[Payload] getSiteStats: only loaded ${allDocs.docs.length}/${allDocs.totalDocs} products for download sum`)
    }

    return {
      totalProducts: allDocs.totalDocs,
      freeProducts: freeProducts.totalDocs,
      totalUsers: users.totalDocs,
      totalDownloads,
    }
  } catch (error) {
    console.error('[Payload] getSiteStats error:', (error as Error).message)
    return null
  }
}

/** Get per-category stats: product count, free count, download sum for each category */
export async function getCategoryStats() {
  noStore()
  const payload = await safeGetPayload()
  if (!payload) return null

  try {
    const categories = await payload.find({ collection: 'categories', sort: 'order', limit: 100, depth: 0 })
    const allProducts = await payload.find({ collection: 'products', limit: 1000, depth: 1 })
    if (allProducts.totalDocs > allProducts.docs.length) {
      console.warn(`[Payload] getCategoryStats: only loaded ${allProducts.docs.length}/${allProducts.totalDocs} products`)
    }

    const stats: Record<string, { totalProducts: number; freeProducts: number; totalDownloads: number }> = {}

    for (const cat of categories.docs) {
      const category = cat as unknown as { id: number; slug: string }
      stats[category.slug] = { totalProducts: 0, freeProducts: 0, totalDownloads: 0 }
    }

    for (const doc of allProducts.docs) {
      const prod = doc as unknown as {
        category?: { slug?: string } | number
        pricing?: { isFree?: boolean; price?: number }
        downloadCount?: number
      }
      const catSlug = typeof prod.category === 'object' ? prod.category?.slug : undefined
      if (!catSlug || !stats[catSlug]) continue
      stats[catSlug].totalProducts += 1
      if (prod.pricing?.isFree || (prod.pricing?.price ?? 1) === 0) stats[catSlug].freeProducts += 1
      stats[catSlug].totalDownloads += prod.downloadCount || 0
    }

    return stats
  } catch (error) {
    console.error('[Payload] getCategoryStats error:', (error as Error).message)
    return null
  }
}

/** Get order stats: total orders, paid orders, total revenue */
export async function getOrderStats() {
  noStore()
  const payload = await safeGetPayload()
  if (!payload) return null

  try {
    const [allOrders, paidOrders] = await Promise.all([
      payload.find({ collection: 'orders', limit: 0, depth: 0 }),
      payload.find({ collection: 'orders', where: { status: { equals: 'paid' } }, limit: 1000, depth: 0 }),
    ])

    const revenue = paidOrders.docs.reduce((sum, doc) => {
      const order = doc as unknown as { total?: number }
      return sum + (order.total || 0)
    }, 0)

    return {
      totalOrders: allOrders.totalDocs,
      paidOrders: paidOrders.totalDocs,
      revenue,
    }
  } catch (error) {
    console.error('[Payload] getOrderStats error:', (error as Error).message)
    return null
  }
}

export async function getBlogPostBySlug(slug: string) {
  noStore()
  const payload = await safeGetPayload()
  if (!payload) return null

  try {
    const result = await payload.find({
      collection: 'blog-posts',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
    })
    return result.docs[0] || null
  } catch (error) {
    console.error('[Payload] getBlogPostBySlug error:', (error as Error).message)
    return null
  }
}
