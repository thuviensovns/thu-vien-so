import type { Metadata } from 'next'
import { Suspense } from 'react'

export const revalidate = 60

import Link from 'next/link'
import {
  Music, Headphones, Zap, Sliders, Guitar, Mic,
  Package, Sparkles, ChevronRight, Download, Gift, Flame, ArrowRight,
} from 'lucide-react'
import { getProducts, getCategoryStats } from '@/lib/payload'
import { ProductListingClient } from '@/components/product/ProductListingClient'
import type { ProductGridItem } from '@/components/product/ProductGrid'
import { CategoryStatsBar, CategoryStatsCount } from '@/components/product/CategoryStatsBar'
import { ProductFilters } from '@/components/product/ProductFilters'
import { ProductSort } from '@/components/product/ProductSort'
import { Pagination } from '@/components/product/Pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { categoryMeta, typeLabels } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Tất cả sản phẩm',
  description: 'Download Sample Pack, FLP Project, VST Plugin & Preset cho Producer',
}

const categoryIcons: Record<string, typeof Music> = {
  'sample-pack': Music,
  'flp': Headphones,
  'vst': Zap,
  'preset': Sliders,
  'instrument': Guitar,
  'song-nhac-lyrics': Mic,
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    type?: string
    sort?: string
    price?: string
    free?: string
  }>
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const isFree = params.free === 'true' ? true : params.price === 'free' ? true : params.price === 'paid' ? false : undefined

  const [products, catStatsMap] = await Promise.all([
    getProducts({
      type: params.type,
      page: Number(params.page) || 1,
      sort: params.sort || '-createdAt',
      isFree,
    }),
    getCategoryStats(),
  ])

  const hasRealData = products.totalDocs > 0
  const totalPages = products.totalPages || 1
  const currentPage = products.page || 1

  // Compute overall stats from DB
  const allCatValues = catStatsMap ? Object.values(catStatsMap) : []
  const overallStats = catStatsMap ? {
    totalProducts: allCatValues.reduce((s, c) => s + c.totalProducts, 0),
    freeProducts: allCatValues.reduce((s, c) => s + c.freeProducts, 0),
    totalDownloads: allCatValues.reduce((s, c) => s + c.totalDownloads, 0),
  } : undefined

  const activeType = params.type ? typeLabels[params.type] || params.type : null

  return (
    <div className="min-h-screen">
      {/* Page header with gradient */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--glow),transparent_70%)]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="container relative mx-auto px-4 py-8 sm:py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link href="/" className="hover:text-primary transition-colors">Trang chủ</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">
              {activeType || 'Tất cả sản phẩm'}
            </span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
                {activeType ? <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-primary" /> : <Package className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                  {activeType || 'Tất cả sản phẩm'}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1.5">
                  {activeType
                    ? `Khám phá bộ sưu tập ${activeType} cho Producer`
                    : 'Download Sample Pack, FLP Project, VST Plugin & Preset cho Producer'
                  }
                </p>
              </div>
            </div>

            {/* Stats */}
            <CategoryStatsBar serverStats={overallStats} />
          </div>

          {/* Category quick links */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/san-pham">
              <Badge
                variant={!params.type ? 'default' : 'outline'}
                className={`cursor-pointer text-xs py-1 px-3 transition-all ${!params.type ? 'bg-primary text-primary-foreground' : 'hover:border-primary/40 hover:text-primary'}`}
              >
                <Package className="h-3 w-3 mr-1" />
                Tất cả
              </Badge>
            </Link>
            {categoryMeta.map((cat) => {
              const CatIcon = categoryIcons[cat.slug] || Package
              const isActive = params.type === cat.slug
              return (
                <Link key={cat.slug} href={`/san-pham?type=${cat.slug}`}>
                  <Badge
                    variant={isActive ? 'default' : 'outline'}
                    className={`cursor-pointer text-xs py-1 px-3 transition-all ${isActive ? 'bg-primary text-primary-foreground' : 'hover:border-primary/40 hover:text-primary'}`}
                  >
                    <CatIcon className="h-3 w-3 mr-1" />
                    {cat.name}
                  </Badge>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-5 sm:gap-6">
          {/* Sidebar filters */}
          <Suspense fallback={<Skeleton className="w-full lg:w-60 h-16 lg:h-80 rounded-xl" />}>
            <ProductFilters />
          </Suspense>

          {/* Products area */}
          <div className="flex-1 min-w-0">
            {/* Sort bar */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {isFree === true && <span className="text-success ml-1">miễn phí</span>}
                  {isFree === false && <span className="text-primary ml-1">trả phí</span>}
                </p>
              </div>
              <Suspense fallback={null}>
                <ProductSort />
              </Suspense>
            </div>

            {/* Product grid — client component for localStorage reactivity */}
            <ProductListingClient
              serverProducts={products.docs as ProductGridItem[]}
              hasRealData={hasRealData}
              typeFilter={params.type}
              isFree={isFree}
              sortKey={params.sort || '-createdAt'}
            />

            {/* Pagination */}
            <Suspense fallback={null}>
              <Pagination totalPages={totalPages} currentPage={currentPage} />
            </Suspense>
          </div>
        </div>

        {/* Category cards section */}
        <Separator className="my-8 sm:my-10" />
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center">
                <Flame className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Khám phá theo danh mục</h2>
                <p className="text-xs text-muted-foreground">Chọn danh mục bạn quan tâm</p>
              </div>
            </div>
            <Link href="/danh-muc" className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 shrink-0">
              Tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categoryMeta.map((cat) => {
              const Icon = categoryIcons[cat.slug] || Package
              return (
                <Link key={cat.slug} href={`/danh-muc/${cat.slug}`} className="group block">
                  <Card className="border-border bg-card hover:border-primary/30 hover:shadow-glow-sm transition-all duration-300 h-full hover:-translate-y-0.5">
                    <CardContent className="p-3 sm:p-4 text-center">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-2 group-hover:from-primary/20 transition-all">
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-xs sm:text-sm group-hover:text-primary transition-colors">{cat.name}</h3>
                      <CategoryStatsCount categorySlug={cat.slug} serverCount={catStatsMap?.[cat.slug]?.totalProducts} />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
