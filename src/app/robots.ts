import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thuvienso.top'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/tai-khoan', '/thanh-toan'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
