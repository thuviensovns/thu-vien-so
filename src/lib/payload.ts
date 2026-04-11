import type { Where } from 'payload'
import { unstable_cache } from 'next/cache'

const emptyResult = { docs: [] as unknown[], totalDocs: 0, totalPages: 0, page: 1 }

const PAYLOAD_TIMEOUT_MS = 15000

/** Default revalidation interval for cached queries (seconds). Kept short so any
 *  transient empty state recovers quickly — products must stay publicly visible. */
const CACHE_TTL = 30
const PRODUCT_CACHE_TTL = 15

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

/** Force a fresh Payload init on next call — use after transient DB/connection errors. */
function resetPayloadCache() {
  _cachedPayload = undefined
  _cacheExpiry = 0
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

type GetProductsOpts = {
  category?: string
  type?: string
  page?: number
  limit?: number
  sort?: string
  search?: string
  isFree?: boolean
}

async function _fetchProducts(opts: GetProductsOpts) {
  const payload = await safeGetPayload()
  if (!payload) throw new Error('Payload unavailable')

  const conditions: Where[] = []

  // Resolve category slug → id before query. This is more reliable than
  // relationship dot-notation traversal, which can silently fail on some
  // Payload/Postgres combinations.
  if (opts.category) {
    const catResult = await payload.find({
      collection: 'categories',
      where: { slug: { equals: opts.category } },
      limit: 1,
      depth: 0,
    })
    const catDoc = catResult.docs[0] as { id?: number } | undefined
    if (!catDoc?.id) {
      // Category doesn't exist — return empty (this is a legitimate not-found, safe to cache)
      return {
        docs: [],
        totalDocs: 0,
        totalPages: 0,
        page: opts.page || 1,
        limit: opts.limit || 12,
        hasNextPage: false,
        hasPrevPage: false,
        nextPage: null,
        prevPage: null,
        pagingCounter: 0,
      }
    }
    conditions.push({ category: { equals: catDoc.id } })
  }

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
}

// Module-scoped cached fetcher — ensures revalidateTag('products') works reliably
const _getProductsCached = unstable_cache(
  async (serializedOpts: string) => _fetchProducts(JSON.parse(serializedOpts)),
  ['products-query'],
  { revalidate: PRODUCT_CACHE_TTL, tags: ['products'] }
)

export async function getProducts(opts: GetProductsOpts) {
  try {
    return await _getProductsCached(JSON.stringify(opts))
  } catch (error) {
    console.error('[Payload] getProducts cached error:', (error as Error).message)
    resetPayloadCache()
    try {
      return await _fetchProducts(opts)
    } catch (retryError) {
      console.error('[Payload] getProducts retry failed:', (retryError as Error).message)
      return emptyResult
    }
  }
}

async function _fetchProductBySlug(slug: string) {
  const payload = await safeGetPayload()
  if (!payload) throw new Error('Payload unavailable')

  const result = await payload.find({
    collection: 'products',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
  })
  return result.docs[0] || null
}

const _getProductBySlugCached = unstable_cache(
  async (slug: string) => _fetchProductBySlug(slug),
  ['product-by-slug'],
  { revalidate: PRODUCT_CACHE_TTL, tags: ['products'] }
)

export async function getProductBySlug(slug: string) {
  try {
    return await _getProductBySlugCached(slug)
  } catch (error) {
    console.error('[Payload] getProductBySlug cached error:', (error as Error).message)
    resetPayloadCache()
    try {
      return await _fetchProductBySlug(slug)
    } catch (retryError) {
      console.error('[Payload] getProductBySlug retry failed:', (retryError as Error).message)
      return null
    }
  }
}

async function _fetchCategories() {
  const payload = await safeGetPayload()
  if (!payload) throw new Error('Payload unavailable')

  return await payload.find({
    collection: 'categories',
    sort: 'order',
    limit: 100,
  })
}

const _getCategoriesCached = unstable_cache(
  _fetchCategories,
  ['categories'],
  { revalidate: CACHE_TTL, tags: ['categories'] }
)

export async function getCategories() {
  try {
    return await _getCategoriesCached()
  } catch (error) {
    console.error('[Payload] getCategories cached error:', (error as Error).message)
    resetPayloadCache()
    try {
      return await _fetchCategories()
    } catch (retryError) {
      console.error('[Payload] getCategories retry failed:', (retryError as Error).message)
      return emptyResult
    }
  }
}

async function _fetchCategoryBySlug(slug: string) {
  const payload = await safeGetPayload()
  if (!payload) throw new Error('Payload unavailable')

  const result = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  return result.docs[0] || null
}

const _getCategoryBySlugCached = unstable_cache(
  async (slug: string) => _fetchCategoryBySlug(slug),
  ['category-by-slug'],
  { revalidate: CACHE_TTL, tags: ['categories'] }
)

export async function getCategoryBySlug(slug: string) {
  try {
    return await _getCategoryBySlugCached(slug)
  } catch (error) {
    console.error('[Payload] getCategoryBySlug cached error:', (error as Error).message)
    resetPayloadCache()
    try {
      return await _fetchCategoryBySlug(slug)
    } catch (retryError) {
      console.error('[Payload] getCategoryBySlug retry failed:', (retryError as Error).message)
      return null
    }
  }
}

type GetBlogPostsOpts = {
  page?: number
  limit?: number
  category?: string
}

async function _fetchBlogPosts(opts?: GetBlogPostsOpts) {
  const payload = await safeGetPayload()
  if (!payload) throw new Error('Payload unavailable')

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
}

const _getBlogPostsCached = unstable_cache(
  async (serializedOpts: string) => _fetchBlogPosts(JSON.parse(serializedOpts)),
  ['blog-posts-query'],
  { revalidate: CACHE_TTL, tags: ['blog-posts'] }
)

export async function getBlogPosts(opts?: GetBlogPostsOpts) {
  try {
    return await _getBlogPostsCached(JSON.stringify(opts || {}))
  } catch (error) {
    console.error('[Payload] getBlogPosts cached error:', (error as Error).message)
    resetPayloadCache()
    try {
      return await _fetchBlogPosts(opts)
    } catch (retryError) {
      console.error('[Payload] getBlogPosts retry failed:', (retryError as Error).message)
      return emptyResult
    }
  }
}

/** Get site-wide stats — cached for 2 minutes */
async function _fetchSiteStats() {
  const payload = await safeGetPayload()
  if (!payload) throw new Error('Payload unavailable')

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
}

const _getSiteStatsCached = unstable_cache(
  _fetchSiteStats,
  ['site-stats'],
  { revalidate: 120, tags: ['products', 'users'] }
)

export async function getSiteStats() {
  try {
    return await _getSiteStatsCached()
  } catch (error) {
    console.error('[Payload] getSiteStats cached error:', (error as Error).message)
    resetPayloadCache()
    try {
      return await _fetchSiteStats()
    } catch (retryError) {
      console.error('[Payload] getSiteStats retry failed:', (retryError as Error).message)
      return null
    }
  }
}

/** Get per-category stats — uses count queries by category ID (avoids relationship-slug traversal) */
async function _fetchCategoryStats() {
  const payload = await safeGetPayload()
  if (!payload) throw new Error('Payload unavailable')

  const categories = await payload.find({ collection: 'categories', sort: 'order', limit: 100, depth: 0 })

  const stats: Record<string, { totalProducts: number; freeProducts: number; totalDownloads: number }> = {}

  // Count queries per category using direct ID match (more reliable than slug traversal)
  await Promise.all(
    categories.docs.map(async (cat) => {
      const category = cat as unknown as { id: number; slug: string }
      const [total, free] = await Promise.all([
        payload.find({
          collection: 'products',
          where: { category: { equals: category.id } },
          limit: 0,
          depth: 0,
        }),
        payload.find({
          collection: 'products',
          where: {
            and: [
              { category: { equals: category.id } },
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
}

const _getCategoryStatsCached = unstable_cache(
  _fetchCategoryStats,
  ['category-stats'],
  { revalidate: 120, tags: ['products', 'categories'] }
)

export async function getCategoryStats() {
  try {
    return await _getCategoryStatsCached()
  } catch (error) {
    console.error('[Payload] getCategoryStats cached error:', (error as Error).message)
    resetPayloadCache()
    try {
      return await _fetchCategoryStats()
    } catch (retryError) {
      console.error('[Payload] getCategoryStats retry failed:', (retryError as Error).message)
      return null
    }
  }
}

/** Get order stats — cached for 2 minutes */
async function _fetchOrderStats() {
  const payload = await safeGetPayload()
  if (!payload) throw new Error('Payload unavailable')

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
}

const _getOrderStatsCached = unstable_cache(
  _fetchOrderStats,
  ['order-stats'],
  { revalidate: 120, tags: ['orders'] }
)

export async function getOrderStats() {
  try {
    return await _getOrderStatsCached()
  } catch (error) {
    console.error('[Payload] getOrderStats cached error:', (error as Error).message)
    resetPayloadCache()
    try {
      return await _fetchOrderStats()
    } catch (retryError) {
      console.error('[Payload] getOrderStats retry failed:', (retryError as Error).message)
      return null
    }
  }
}

async function _fetchBlogPostBySlug(slug: string) {
  const payload = await safeGetPayload()
  if (!payload) throw new Error('Payload unavailable')

  const result = await payload.find({
    collection: 'blog-posts',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
  })
  return result.docs[0] || null
}

const _getBlogPostBySlugCached = unstable_cache(
  async (slug: string) => _fetchBlogPostBySlug(slug),
  ['blog-post-by-slug'],
  { revalidate: CACHE_TTL, tags: ['blog-posts'] }
)

export async function getBlogPostBySlug(slug: string) {
  try {
    return await _getBlogPostBySlugCached(slug)
  } catch (error) {
    console.error('[Payload] getBlogPostBySlug cached error:', (error as Error).message)
    resetPayloadCache()
    try {
      return await _fetchBlogPostBySlug(slug)
    } catch (retryError) {
      console.error('[Payload] getBlogPostBySlug retry failed:', (retryError as Error).message)
      return null
    }
  }
}
