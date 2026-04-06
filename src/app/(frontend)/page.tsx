import { HomeContent } from '@/components/home/HomeContent'
import { getProducts, getCategories, getSiteStats } from '@/lib/payload'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

/** Fetch site content from DB for SSR (no flash) */
async function getSiteContentSSR() {
  try {
    const payload = await getPayload({ config })
    const data = await payload.findGlobal({ slug: 'site-content' }) as any
    return {
      settings: data?.settings || null,
      categoryDescriptions: data?.categoryDescriptions || null,
    }
  } catch {
    return { settings: null, categoryDescriptions: null }
  }
}

export default async function HomePage() {
  const [products, categories, siteStats, siteContent] = await Promise.all([
    getProducts({ limit: 50, sort: '-createdAt' }),
    getCategories(),
    getSiteStats(),
    getSiteContentSSR(),
  ])

  const hasRealData = products.totalDocs > 0

  return (
    <HomeContent
      serverProducts={hasRealData ? (products.docs as Record<string, unknown>[]) : []}
      serverCategories={hasRealData ? (categories.docs as Record<string, unknown>[]) : []}
      hasRealData={hasRealData}
      siteStats={siteStats ? {
        totalProducts: siteStats.totalProducts,
        freeProducts: siteStats.freeProducts,
        totalUsers: siteStats.totalUsers,
        totalDownloads: siteStats.totalDownloads,
      } : undefined}
      initialSettings={siteContent.settings}
      initialCatDescs={siteContent.categoryDescriptions}
    />
  )
}
