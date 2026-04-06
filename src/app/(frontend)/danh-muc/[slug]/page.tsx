import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'
import Link from 'next/link'
import {
  Music, Headphones, Zap, Sliders, Guitar, Mic,
  Package, Download, Gift, ChevronRight, Sparkles, ArrowUpDown,
} from 'lucide-react'
import { getCategoryBySlug, getProducts, getCategoryStats } from '@/lib/payload'
import { demoCategoryDescriptions, getCategoryMetaSorted } from '@/lib/demo-data'
import { ProductListingClient } from '@/components/product/ProductListingClient'
import type { ProductGridItem } from '@/components/product/ProductGrid'
import { CategoryStatsBar } from '@/components/product/CategoryStatsBar'
import { CategoryDescClient } from '@/components/product/CategoryDescClient'
import { ProductSort } from '@/components/product/ProductSort'
import { Pagination } from '@/components/product/Pagination'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { categoryMeta, typeLabels } from '@/lib/config'

const categoryIcons: Record<string, typeof Music> = {
  'sample-pack': Music,
  'flp': Headphones,
  'vst': Zap,
  'preset': Sliders,
  'instrument': Guitar,
  'song-nhac-lyrics': Mic,
}

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string; sort?: string; price?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  const meta = categoryMeta.find((c) => c.slug === slug)
  const name = category?.name || meta?.name || typeLabels[slug] || slug

  const description = demoCategoryDescriptions[slug] || `Download ${name} miễn phí và premium cho Producer`
  return {
    title: `${name} - Download cho Producer`,
    description,
    openGraph: { title: `${name} - Thư Viện Số`, description, type: 'website' },
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams

  // Validate category exists in our config
  const meta = categoryMeta.find((c) => c.slug === slug)
  if (!meta) notFound()

  const [category, catStatsMap] = await Promise.all([
    getCategoryBySlug(slug),
    getCategoryStats(),
  ])
  const categoryName = category?.name || meta.name
  const categoryDesc = category?.description || demoCategoryDescriptions[slug] || meta.description

  const isFree = sp.price === 'free' ? true : sp.price === 'paid' ? false : undefined

  const products = await getProducts({
    category: slug,
    page: Number(sp.page) || 1,
    sort: sp.sort || '-createdAt',
    isFree,
  })

  // Use demo data if DB returns no products
  const hasRealData = products.totalDocs > 0
  const categoryServerStats = catStatsMap?.[slug]
  const totalPages = hasRealData ? products.totalPages : 1
  const currentPage = hasRealData ? (products.page || 1) : 1

  const IconComponent = categoryIcons[slug] || Package

  // Sibling categories for navigation
  const siblings = getCategoryMetaSorted().filter((c) => c.slug !== slug)

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--glow),transparent_70%)]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="container relative mx-auto px-4 py-8 sm:py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link href="/" className="hover:text-primary transition-colors">Trang chủ</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/san-pham" className="hover:text-primary transition-colors">Sản phẩm</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{categoryName}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-start gap-4">
              {/* Category icon */}
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
                <IconComponent className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">{categoryName}</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1.5 max-w-xl leading-relaxed">
                  <CategoryDescClient slug={slug} fallback={categoryDesc} />
                </p>
              </div>
            </div>

            {/* Stats cards — client-aware */}
            <CategoryStatsBar categorySlug={slug} serverStats={categoryServerStats} />
          </div>

          {/* Sibling category quick links */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/san-pham">
              <Badge variant="outline" className="cursor-pointer text-xs hover:border-primary/40 hover:text-primary transition-all py-1 px-3">
                <Package className="h-3 w-3 mr-1" />
                Tất cả
              </Badge>
            </Link>
            <Badge className="bg-primary text-primary-foreground text-xs py-1 px-3">
              <IconComponent className="h-3 w-3 mr-1" />
              {categoryName}
            </Badge>
            {siblings.map((cat) => {
              const SibIcon = categoryIcons[cat.slug] || Package
              return (
                <Link key={cat.slug} href={`/danh-muc/${cat.slug}`}>
                  <Badge variant="outline" className="cursor-pointer text-xs hover:border-primary/40 hover:text-primary transition-all py-1 px-3">
                    <SibIcon className="h-3 w-3 mr-1" />
                    {cat.name}
                  </Badge>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-64 shrink-0">
            <div className="lg:sticky lg:top-[4.5rem] space-y-4">
              {/* Price filter */}
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <ArrowUpDown className="h-3 w-3 text-primary" />
                    </div>
                    Bộ lọc
                  </h3>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Tất cả sản phẩm', value: '', icon: Package },
                      { label: 'Miễn phí', value: 'free', icon: Gift },
                      { label: 'Trả phí', value: 'paid', icon: Sparkles },
                    ].map((filter) => {
                      const isActive = (sp.price || '') === filter.value
                      const href = filter.value
                        ? `/danh-muc/${slug}?price=${filter.value}`
                        : `/danh-muc/${slug}`
                      return (
                        <Link
                          key={filter.value || 'all'}
                          href={href}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive
                              ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          <filter.icon className="h-3.5 w-3.5" />
                          {filter.label}
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Category navigation */}
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3">Danh mục khác</h3>
                  <div className="space-y-1">
                    {getCategoryMetaSorted().map((cat) => {
                      const CatIcon = categoryIcons[cat.slug] || Package
                      const isActive = cat.slug === slug
                      return (
                        <Link
                          key={cat.slug}
                          href={`/danh-muc/${cat.slug}`}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive
                              ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          <CatIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{cat.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Download info card */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="p-4 text-center">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <Download className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">Tải miễn phí</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Nhiều sản phẩm miễn phí chất lượng cao. Đăng ký để tải ngay!
                  </p>
                  <Link
                    href={`/danh-muc/${slug}?price=free`}
                    className="inline-block mt-3 text-xs text-primary font-medium hover:underline"
                  >
                    Xem sản phẩm miễn phí →
                  </Link>
                </CardContent>
              </Card>
            </div>
          </aside>

          {/* Products area */}
          <div className="flex-1 min-w-0">
            {/* Sort bar */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {sp.price === 'free' && <span className="text-success ml-1">miễn phí</span>}
                  {sp.price === 'paid' && <span className="text-primary ml-1">trả phí</span>}
                </p>
                {!hasRealData && (
                  <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                    Demo
                  </Badge>
                )}
              </div>
              <Suspense fallback={null}>
                <ProductSort />
              </Suspense>
            </div>

            {/* Product grid — client component for localStorage reactivity */}
            <ProductListingClient
              serverProducts={products.docs as ProductGridItem[]}
              hasRealData={hasRealData}
              categorySlug={slug}
              isFree={isFree}
              sortKey={sp.sort || '-createdAt'}
            />

            {/* Pagination */}
            <Suspense fallback={null}>
              <Pagination totalPages={totalPages} currentPage={currentPage} />
            </Suspense>

            {/* Category description section */}
            <div className="mt-10 pt-6 border-t border-border/50">
              <h2 className="text-lg font-bold mb-3">Về {categoryName}</h2>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                <p><CategoryDescClient slug={slug} fallback={categoryDesc} /></p>
                <p>
                  Tất cả sản phẩm đều được kiểm tra chất lượng và tương thích với các DAW phổ biến.
                  Hỗ trợ download nhanh và cập nhật miễn phí.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
