'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Download, Guitar, Headphones, Mic, Music, Zap, Sliders, Monitor,
  Star, TrendingUp, Users, Flame, Gift, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ProductCard } from '@/components/shared/ProductCard'
import { TopUpLeaderboard } from '@/components/shared/TopUpLeaderboard'
import { FadeIn, Reveal, Stagger, StaggerItem } from '@/components/shared/motion'
import { getCategoryDescriptions, type DemoProduct } from '@/lib/demo-data'
import { getSiteSettings, defaultSiteSettings, categoryMeta } from '@/lib/config'
import { mapPayloadDoc } from '@/lib/product-mapper'

const categoryIcons: Record<string, typeof Music> = { Music, Headphones, Zap, Sliders, Guitar, Mic, Monitor }


function computeStats(products: DemoProduct[]) {
  const byCategory: Record<string, { totalProducts: number; freeProducts: number; totalDownloads: number }> = {}
  for (const p of products) {
    const slug = p.category?.slug
    if (!slug) continue
    if (!byCategory[slug]) byCategory[slug] = { totalProducts: 0, freeProducts: 0, totalDownloads: 0 }
    byCategory[slug].totalProducts += 1
    if (p.pricing.isFree || p.pricing.price === 0) byCategory[slug].freeProducts += 1
    byCategory[slug].totalDownloads += p.downloadCount || 0
  }
  return byCategory
}

function toCardProps(p: DemoProduct) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    thumbnail: p.thumbnail.url,
    price: p.pricing.price,
    originalPrice: p.pricing.originalPrice,
    isFree: p.pricing.isFree,
    downloadCount: p.downloadCount,
    bpm: p.preview?.bpm,
    musicalKey: p.preview?.musicalKey,
    featured: p.featured,
  }
}

interface SiteStatsData {
  totalProducts: number
  freeProducts: number
  totalUsers: number
  totalDownloads: number
}

interface HomeContentProps {
  serverProducts?: Record<string, unknown>[]
  serverCategories?: Record<string, unknown>[]
  hasRealData?: boolean
  siteStats?: SiteStatsData
  initialSettings?: Record<string, unknown> | null
  initialCatDescs?: Record<string, string> | null
}

export function HomeContent({ serverProducts = [], serverCategories = [], hasRealData = false, siteStats, initialSettings, initialCatDescs }: HomeContentProps) {
  const [products, setProducts] = useState<DemoProduct[]>(() => {
    if (serverProducts.length > 0) {
      return serverProducts.map(mapPayloadDoc)
    }
    return []
  })
  // Use server-fetched DB data as initial state to prevent flash
  const [settings, setSettings] = useState(() =>
    initialSettings ? { ...defaultSiteSettings, ...initialSettings } as typeof defaultSiteSettings : defaultSiteSettings
  )

  const [catDescs, setCatDescs] = useState<Record<string, string>>(() =>
    initialCatDescs ? initialCatDescs : {}
  )

  const refresh = useCallback(() => {
    setSettings(getSiteSettings())
    setCatDescs(getCategoryDescriptions())
  }, [])

  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_site_settings' || e.key === 'admin_category_descriptions') {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const catStats = useMemo(() => computeStats(products), [products])
  // Always use real DB stats — never fall back to demo inflated numbers
  const totalProducts = siteStats?.totalProducts ?? products.length
  const totalDownloads = siteStats?.totalDownloads ?? 0
  const totalFree = siteStats?.freeProducts ?? products.filter(p => p.pricing.isFree || p.pricing.price === 0).length
  const totalUsers = siteStats?.totalUsers ?? 0

  const featuredProducts = useMemo(() => products.filter((p) => p.featured), [products])
  const freeProducts = useMemo(() => products.filter((p) => p.pricing.isFree || p.pricing.price === 0), [products])

  function formatNum(n: number): string {
    if (n === 0) return '0'
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+`
    return `${n}+`
  }

  const stats = [
    { label: 'Sản phẩm', value: formatNum(totalProducts), icon: Star },
    { label: 'Lượt tải', value: formatNum(totalDownloads), icon: Download },
    { label: 'Người dùng', value: formatNum(totalUsers), icon: Users },
    { label: 'Miễn phí', value: formatNum(totalFree), icon: TrendingUp },
  ]

  return (
    <>
      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-secondary/8" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)]" />

        <div className="container relative mx-auto px-4 py-12 sm:py-16 md:py-20 lg:py-24">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8">
            {/* Left: Hero content */}
            <FadeIn className="flex-1 text-center lg:text-left">
              <Badge variant="secondary" className="mb-4 bg-secondary/10 text-secondary border-secondary/20 text-xs sm:text-sm">
                {settings.heroBadge || `Hơn ${totalProducts}+ tài nguyên cho Producer`}
              </Badge>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-bold tracking-tight leading-tight">
                {settings.heroTitle || (
                  <>
                    Thư Viện{' '}
                    <span className="text-primary">Số</span>{' '}
                    <span className="text-secondary">Việt Nam</span>
                  </>
                )}
              </h1>

              <p className="mt-3 sm:mt-4 text-base sm:text-lg text-muted-foreground md:text-xl max-w-2xl lg:max-w-none">
                {settings.heroSubtitle || 'Download Sample Pack, FLP Project, VST Plugin & Preset chất lượng cao. Tài nguyên EDM, Vinahouse dành riêng cho Producer Việt.'}
              </p>

              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3">
                <Button size="lg" asChild className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow">
                  <Link href="/san-pham">
                    Khám phá ngay
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="w-full sm:w-auto border-border hover:border-primary/50">
                  <Link href="/san-pham?free=true">
                    Tải miễn phí
                    <Download className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Stats */}
              <Stagger className="mt-10 sm:mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {stats.map((stat) => (
                  <StaggerItem key={stat.label} className="text-center p-3 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
                    <stat.icon className="h-4 w-4 text-primary mx-auto mb-1" />
                    <div className="text-xl sm:text-2xl font-bold text-primary font-mono">{stat.value}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
                  </StaggerItem>
                ))}
              </Stagger>
            </FadeIn>

            {/* Right: Top Nạp Leaderboard */}
            <div className="mt-8 lg:mt-0 lg:w-80 lg:shrink-0">
              <TopUpLeaderboard />
            </div>
          </div>
        </div>
      </section>

      {/* ===== CATEGORIES ===== */}
      <section className="container mx-auto px-4 py-10 sm:py-14 md:py-16">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Danh mục sản phẩm</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Chọn danh mục bạn quan tâm</p>
          </div>
          <Link href="/danh-muc" className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0">
            Xem tất cả <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
          {categoryMeta.map((cat) => {
            const Icon = categoryIcons[cat.iconName as keyof typeof categoryIcons] || Music
            const cs = catStats[cat.slug]
            return (
              <StaggerItem key={cat.slug}>
              <Link href={`/danh-muc/${cat.slug}`}>
                <Card className="group border-border bg-card hover:border-primary/30 hover:shadow-glow-sm transition-all duration-300 h-full hover:-translate-y-0.5">
                  <CardContent className="p-4 sm:p-5 text-center">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-3 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300">
                      <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                      {cat.name}
                    </h3>
                    {cs && (
                      <p className="text-[11px] text-muted-foreground mt-1">{cs.totalProducts} sản phẩm</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 hidden sm:block">{catDescs[cat.slug] || cat.description}</p>
                  </CardContent>
                </Card>
              </Link>
              </StaggerItem>
            )
          })}
        </Stagger>
      </section>

      {/* ===== FEATURED PRODUCTS ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
        <div className="container relative mx-auto px-4 py-10 sm:py-14 md:py-16">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-warning/20 to-warning/10 flex items-center justify-center">
                <Flame className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Sản phẩm nổi bật</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Được yêu thích nhất bởi cộng đồng Producer</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0 border-border hover:border-primary/40 hover:text-primary">
              <Link href="/san-pham">
                Xem tất cả
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Link>
            </Button>
          </div>

          <Stagger className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {featuredProducts.slice(0, 8).map((product) => (
              <StaggerItem key={product.slug}>
                <ProductCard {...toCardProps(product)} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ===== FREE DOWNLOADS ===== */}
      <section className="border-t border-b border-border bg-card/30">
        <div className="container mx-auto px-4 py-10 sm:py-14 md:py-16">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-success/20 to-success/10 flex items-center justify-center">
                <Gift className="h-5 w-5 text-success" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Tài nguyên miễn phí</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Sample Pack, FLP, Preset hoàn toàn miễn phí
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0 border-border hover:border-success/40 hover:text-success">
              <Link href="/san-pham?free=true">
                Xem tất cả
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Link>
            </Button>
          </div>

          <Stagger className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {freeProducts.slice(0, 8).map((product) => (
              <StaggerItem key={product.slug}>
                <ProductCard {...toCardProps(product)} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ===== LATEST PRODUCTS ===== */}
      <section className="container mx-auto px-4 py-10 sm:py-14 md:py-16">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Mới cập nhật</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Sản phẩm mới nhất được thêm vào thư viện</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0 border-border hover:border-primary/40 hover:text-primary">
            <Link href="/san-pham">
              Xem tất cả
              <ArrowRight className="ml-1.5 h-3 w-3" />
            </Link>
          </Button>
        </div>

        <Stagger className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.slice(0, 8).map((product) => (
            <StaggerItem key={product.slug}>
              <ProductCard {...toCardProps(product)} />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ===== CTA ===== */}
      <section className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        <Reveal className="relative rounded-xl sm:rounded-2xl border border-border overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--glow),transparent_70%)]" />
          <div className="relative p-6 sm:p-8 md:p-12 text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">
              Bắt đầu sáng tạo ngay hôm nay
            </h2>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
              Đăng ký miễn phí để truy cập hàng trăm tài nguyên sản xuất nhạc chất lượng cao.
              Cập nhật sản phẩm mới mỗi tuần.
            </p>
            <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" asChild className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow">
                <Link href="/dang-ky">Đăng ký miễn phí</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/blog">Đọc hướng dẫn</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
