import type { Where } from 'payload'
import { unstable_cache } from 'next/cache'

const emptyResult = { docs: [] as unknown[], totalDocs: 0, totalPages: 0, page: 1 }

const PAYLOAD_TIMEOUT_MS = 15000

/** Default revalidation interval for cached queries (seconds) */
const CACHE_TTL = 60

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
    _cacheExpiry = now + 30_000
    return null
  }
}

export async function getPayloadClient() {
  return safeGetPayload()
}

/**
 * Get Payload instance for API routes — throws on timeout.
 * Reuses cached instance from safeGetPayload when available.
 */
export async function getPayloadForApi(timeoutMs = 15000) {
  // Reuse cached instance if available (avoids re-init on every request)
  if (_cachedPayload) return _cachedPayload

  const { getPayload } = await import('payload')
  const config = (await import('@payload-config')).default
  const instance = await withTimeout(getPayload({ config }), timeoutMs)
  _cachedPayload = instance
  return instance
}

// ─── Cached query functions ───────────────────────────────────────────

async function _getProducts(opts: {
  category?: string
  type?: string
  page?: number
  limit?: number
  sort?: string
  search?: string
  isFree?: boolean
}) {
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

// Module-scoped cached fetcher — ensures revalidateTag('products') works reliably
const _getProductsCached = unstable_cache(
  async (serializedOpts: string) => _getProducts(JSON.parse(serializedOpts)),
  ['products-query'],
  { revalidate: CACHE_TTL, tags: ['products'] }
)

export async function getProducts(opts: Parameters<typeof _getProducts>[0]) {
  return _getProductsCached(JSON.stringify(opts))
}

async function _getProductBySlug(slug: string) {
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

const _getProductBySlugCached = unstable_cache(
  async (slug: string) => _getProductBySlug(slug),
  ['product-by-slug'],
  { revalidate: CACHE_TTL, tags: ['products'] }
)

export async function getProductBySlug(slug: string) {
  return _getProductBySlugCached(slug)
}

async function _getCategories() {
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

const _getCategoriesCached = unstable_cache(
  _getCategories,
  ['categories'],
  { revalidate: CACHE_TTL, tags: ['categories'] }
)

export async function getCategories() {
  return _getCategoriesCached()
}

async function _getCategoryBySlug(slug: string) {
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

const _getCategoryBySlugCached = unstable_cache(
  async (slug: string) => _getCategoryBySlug(slug),
  ['category-by-slug'],
  { revalidate: CACHE_TTL, tags: ['categories'] }
)

export async function getCategoryBySlug(slug: string) {
  return _getCategoryBySlugCached(slug)
}

async function _getBlogPosts(opts?: {
  page?: number
  limit?: number
  category?: string
}) {
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

const _getBlogPostsCached = unstable_cache(
  async (serializedOpts: string) => _getBlogPosts(JSON.parse(serializedOpts)),
  ['blog-posts-query'],
  { revalidate: CACHE_TTL, tags: ['blog-posts'] }
)

export async function getBlogPosts(opts?: Parameters<typeof _getBlogPosts>[0]) {
  return _getBlogPostsCached(JSON.stringify(opts || {}))
}

/** Get site-wide stats — cached for 2 minutes */
async function _getSiteStats() {
  const payload = await safeGetPayload()
  if (!payload) return null

  try {
    const [allProducts, freeProducts, users] = await Promise.all([
      payload.find({ collection: 'products', limit: 0, depth: 0 }),
      payload.find({ collection: 'products', where: { 'pricing.isFree': { equals: true } }, limit: 0, depth: 0 }),
      payload.find({ collection: 'users', limit: 0, depth: 0 }),
    ])

    return {
      totalProducts: allProducts.totalDocs,
      freeProducts: freeProducts.totalDocs,
      totalUsers: users.totalDocs,
      totalDownloads: 0, // Skip expensive full-scan; use a counter collection later
    }
  } catch (error) {
    console.error('[Payload] getSiteStats error:', (error as Error).message)
    return null
  }
}

const _getSiteStatsCached = unstable_cache(
  _getSiteStats,
  ['site-stats'],
  { revalidate: 120, tags: ['products', 'users'] }
)

export async function getSiteStats() {
  return _getSiteStatsCached()
}

/** Get per-category stats — uses count queries instead of loading all products */
async function _getCategoryStats() {
  const payload = await safeGetPayload()
  if (!payload) return null

  try {
    const categories = await payload.find({ collection: 'categories', sort: 'order', limit: 100, depth: 0 })

    const stats: Record<string, { totalProducts: number; freeProducts: number; totalDownloads: number }> = {}

    // Use parallel count queries per category instead of loading ALL products
    await Promise.all(
      categories.docs.map(async (cat) => {
        const category = cat as unknown as { id: number; slug: string }
        const [total, free] = await Promise.all([
          payload.find({
            collection: 'products',
            where: { 'category.slug': { equals: category.slug } },
            limit: 0,
            depth: 0,
          }),
          payload.find({
            collection: 'products',
            where: {
              and: [
                { 'category.slug': { equals: category.slug } },
                { 'pricing.isFree': { equals: true } },
              ],
            },
            limit: 0,
            depth: 0,
          }),
        ])
        stats[category.slug] = {
          totalProducts: total.totalDocs,
          freeProducts: free.totalDocs,
          totalDownloads: 0,
        }
      })
    )

    return stats
  } catch (error) {
    console.error('[Payload] getCategoryStats error:', (error as Error).message)
    return null
  }
}

const _getCategoryStatsCached = unstable_cache(
  _getCategoryStats,
  ['category-stats'],
  { revalidate: 120, tags: ['products', 'categories'] }
)

export async function getCategoryStats() {
  return _getCategoryStatsCached()
}

/** Get order stats — cached for 2 minutes */
async function _getOrderStats() {
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

const _getOrderStatsCached = unstable_cache(
  _getOrderStats,
  ['order-stats'],
  { revalidate: 120, tags: ['orders'] }
)

export async function getOrderStats() {
  return _getOrderStatsCached()
}

async function _getBlogPostBySlug(slug: string) {
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

const _getBlogPostBySlugCached = unstable_cache(
  async (slug: string) => _getBlogPostBySlug(slug),
  ['blog-post-by-slug'],
  { revalidate: CACHE_TTL, tags: ['blog-posts'] }
)

export async function getBlogPostBySlug(slug: string) {
  return _getBlogPostBySlugCached(slug)
}
