import type { Metadata } from 'next'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Search, ChevronRight } from 'lucide-react'
import { getProducts } from '@/lib/payload'
import { SearchResultsClient } from '@/components/product/SearchResultsClient'
import { Pagination } from '@/components/product/Pagination'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from './SearchInput'

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams
  return {
    title: params.q ? `Tìm kiếm: ${params.q}` : 'Tìm kiếm',
  }
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = params.q?.trim() || ''

  let hasRealData = false
  let serverProducts: any[] = []
  let totalPages = 0
  let currentPage = 1
  let totalDocs = 0

  if (query) {
    const products = await getProducts({
      search: query,
      page: Number(params.page) || 1,
      limit: 12,
    })

    totalDocs = products.totalDocs
    if (products.totalDocs > 0) {
      hasRealData = true
      serverProducts = products.docs
      totalPages = products.totalPages
      currentPage = products.page || 1
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--glow),transparent_70%)]" />
        <div className="container relative mx-auto px-4 py-8 sm:py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link href="/" className="hover:text-primary transition-colors">Trang chủ</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Tìm kiếm</span>
            {query && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="text-primary font-medium">"{query}"</span>
              </>
            )}
          </nav>

          <div className="flex items-start gap-4 mb-6">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
              <Search className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                {query ? `Kết quả: "${query}"` : 'Tìm kiếm sản phẩm'}
              </h1>
              {query && hasRealData && (
                <p className="text-sm text-muted-foreground mt-1">
                  Tìm thấy <span className="text-foreground font-semibold">{totalDocs}</span> sản phẩm
                </p>
              )}
            </div>
          </div>

          {/* Search input on page */}
          <Suspense fallback={null}>
            <SearchInput defaultQuery={query} />
          </Suspense>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {!query ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
            <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">Nhập từ khóa để tìm kiếm</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Tìm Sample Pack, FLP Project, VST Plugin, Preset và nhiều hơn nữa
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['Vinahouse', 'Trap', 'Future Bass', 'Lo-Fi', 'EDM', 'Serum'].map((tag) => (
                <Link
                  key={tag}
                  href={`/tim-kiem?q=${encodeURIComponent(tag)}`}
                  className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        ) : query ? (
          <>
            <SearchResultsClient
              query={query}
              serverProducts={serverProducts}
              hasRealData={hasRealData}
            />
            {hasRealData && totalPages > 1 && (
              <Suspense fallback={null}>
                <Pagination totalPages={totalPages} currentPage={currentPage} />
              </Suspense>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
