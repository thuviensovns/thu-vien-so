import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ChatWidgetLazy } from '@/components/chat/ChatWidgetLazy'
import { VocalJobPill } from '@/components/vocal-remover/VocalJobPill'
import { Providers } from '@/components/providers/Providers'
import AffiliateRefCapture from '@/components/AffiliateRefCapture'
import SiteContentSync from '@/components/providers/SiteContentSync'
import { SiteContentHydrator } from '@/components/providers/SiteContentHydrator'
import { RouteProgress } from '@/components/shared/RouteProgress'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { PageTransition } from '@/components/shared/PageTransition'
import { MobileBottomBar } from '@/components/layout/MobileBottomBar'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thuvienso.top'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Thư Viện Số - Tài Nguyên FLP, VST, Sample Cho Producer',
    template: '%s | Thư Viện Số',
  },
  description:
    'Download Sample Pack, FLP Project, VST Plugin & Preset miễn phí và premium. Tài nguyên EDM, Vinahouse cho Producer Việt Nam.',
  keywords: [
    'FL Studio', 'Sample Pack', 'FLP Project', 'VST Plugin',
    'Preset', 'Vinahouse', 'EDM', 'Producer', 'Việt Nam',
    'nhạc điện tử', 'tải nhạc', 'sản xuất nhạc',
  ],
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'Thư Viện Số',
    title: 'Thư Viện Số - Tài Nguyên FLP, VST, Sample Cho Producer',
    description: 'Download Sample Pack, FLP Project, VST Plugin & Preset miễn phí và premium. Tài nguyên EDM, Vinahouse cho Producer Việt Nam.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Thư Viện Số' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Thư Viện Số - Tài Nguyên Cho Producer',
    description: 'Download Sample Pack, FLP, VST Plugin & Preset cho Producer Việt Nam.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/logo-icon.svg',
  },
  robots: {
    index: true,
    follow: true,
  },
}

/** Fetch site content from Payload DB — cached for 60s */
const getSiteContentFromDB = unstable_cache(
  async (): Promise<{ settings: Record<string, unknown> | null; categoryDescriptions: Record<string, string> | null }> => {
    try {
      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      const payload = await getPayload({ config })
      const data = await payload.findGlobal({ slug: 'site-content' }) as { settings?: Record<string, unknown> | null; categoryDescriptions?: Record<string, string> | null }
      return {
        settings: data?.settings || null,
        categoryDescriptions: data?.categoryDescriptions || null,
      }
    } catch {
      return { settings: null, categoryDescriptions: null }
    }
  },
  ['site-content'],
  { revalidate: 60, tags: ['site-content'] }
)

export default async function FrontendLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch site content from DB during SSR — no flash on page load
  const siteContent = await getSiteContentFromDB()

  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans bg-background text-foreground antialiased`}
      >
        <SiteContentHydrator
          settings={siteContent.settings}
          categoryDescriptions={siteContent.categoryDescriptions}
        />
        <Providers>
          <Suspense fallback={null}>
            <RouteProgress />
            <ScrollToTop />
            <AffiliateRefCapture />
          </Suspense>
          <SiteContentSync />
          {/* Skip to content — keyboard accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm"
          >
            Bỏ qua đến nội dung chính
          </a>

          <div className="flex min-h-screen flex-col pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0">
            <Header />
            <main id="main-content" className="flex-1"><PageTransition>{children}</PageTransition></main>
            <Footer initialSettings={siteContent.settings} />
            <ChatWidgetLazy />
            <VocalJobPill />
          </div>
          <MobileBottomBar />
        </Providers>
      </body>
    </html>
  )
}
