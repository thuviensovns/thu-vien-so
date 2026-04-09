import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thuvienso.top'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/san-pham`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/blog`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${siteUrl}/danh-muc/sample-pack`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/danh-muc/flp`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/danh-muc/vst`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/danh-muc/preset`, changeFrequency: 'weekly', priority: 0.8 },
  ]

  // Dynamic product pages (from Payload CMS when DB connected)
  let productPages: MetadataRoute.Sitemap = []
  let blogPages: MetadataRoute.Sitemap = []

  try {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })

    const products = await payload.find({
      collection: 'products',
      limit: 1000,
      select: { slug: true, updatedAt: true },
    })

    productPages = products.docs.map((p) => ({
      url: `${siteUrl}/san-pham/${p.slug}`,
      lastModified: p.updatedAt as string | undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    const posts = await payload.find({
      collection: 'blog-posts',
      limit: 1000,
      select: { slug: true, updatedAt: true },
    })

    blogPages = posts.docs.map((p) => ({
      url: `${siteUrl}/blog/${p.slug}`,
      lastModified: p.updatedAt as string | undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  } catch {
    // DB not connected yet — return only static pages
  }

  return [...staticPages, ...productPages, ...blogPages]
}
