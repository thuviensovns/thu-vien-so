import type { Where } from 'payload'
import { unstable_cache } from 'next/cache'
import { getDbPool } from './db-pool'

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
let _migrationRan = false

async function safeGetPayload() {
  const now = Date.now()
  if (_cachedPayload !== undefined) {
    if (_cachedPayload === null && now < _cacheExpiry) return null
    if (_cachedPayload !== null) return _cachedPayload
  }

  // Auto-run DB migration on first cold start
  if (!_migrationRan) {
    _migrationRan = true
    try {
      const { ensureTablesExist } = await import('./db-migrate')
      await ensureTablesExist()
    } catch { /* non-fatal */ }
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

  // Auto-run DB migration on first cold start (push:false means Payload
  // never creates new columns; this ensures they exist before Payload
  // tries to use them)
  if (!_migrationRan) {
    _migrationRan = true
    try {
      const { ensureTablesExist } = await import('./db-migrate')
      const result = await ensureTablesExist()
      if (result.executed.length > 0) {
        console.log('[DB Migration] Executed:', result.executed.join(', '))
      }
      if (result.errors.length > 0) {
        console.warn('[DB Migration] Errors:', result.errors.join(', '))
      }
    } catch (e) {
      console.warn('[DB Migration] Failed (non-fatal):', (e as Error).message)
    }
  }

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

/** Get site-wide stats — one raw SQL query instead of 3 Payload counts. */
async function _fetchSiteStats() {
  const { rows } = await getDbPool().query<{
    total_products: number
    free_products: number
    total_users: number
    total_downloads: number
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM products) AS total_products,
       (SELECT COUNT(*)::int FROM products WHERE pricing_is_free IS TRUE) AS free_products,
       (SELECT COUNT(*)::int FROM users) AS total_users,
       (SELECT COALESCE(SUM(download_count), 0)::int FROM products) AS total_downloads`,
  )
  const r = rows[0] || { total_products: 0, free_products: 0, total_users: 0, total_downloads: 0 }
  return {
    totalProducts: r.total_products,
    freeProducts: r.free_products,
    totalUsers: r.total_users,
    totalDownloads: r.total_downloads,
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

/** Get per-category stats — single raw SQL aggregation.
 *
 *  Previously fired 2 payload.find({limit:0}) per category — ~14 round-trips
 *  for 7 categories. Now one grouped query counts + sums everything at once.
 */
async function _fetchCategoryStats() {
  const pool = getDbPool()

  const [categories, agg] = await Promise.all([
    pool.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM categories ORDER BY "order" ASC LIMIT 100`,
    ),
    pool.query<{ category_id: number; total: number; free: number; downloads: number }>(
      `SELECT category_id,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE pricing_is_free IS TRUE)::int AS free,
              COALESCE(SUM(download_count), 0)::int AS downloads
       FROM products
       WHERE category_id IS NOT NULL
       GROUP BY category_id`,
    ),
  ])

  const byCat: Record<number, { total: number; free: number; downloads: number }> = {}
  for (const row of agg.rows) {
    byCat[row.category_id] = { total: row.total, free: row.free, downloads: row.downloads }
  }

  const stats: Record<string, { totalProducts: number; freeProducts: number; totalDownloads: number }> = {}
  for (const c of categories.rows) {
    const s = byCat[c.id]
    stats[c.slug] = {
      totalProducts: s?.total ?? 0,
      freeProducts: s?.free ?? 0,
      totalDownloads: s?.downloads ?? 0,
    }
  }
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
