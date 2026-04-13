'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Music, Headphones, Zap, Sliders, Guitar, Mic, Monitor, Package, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCategoryDescriptions } from '@/lib/demo-data'
import { categoryMeta } from '@/lib/config'

const categoryIcons: Record<string, typeof Music> = {
  'sample-pack': Music, 'flp': Headphones, 'vst': Zap,
  'preset': Sliders, 'instrument': Guitar, 'song-nhac-lyrics': Mic, 'cai-dat-phan-mem': Monitor,
}

const categoryColors: Record<string, string> = {
  'sample-pack': 'from-cyan-500/20 to-info/10 border-cyan-500/20 hover:border-cyan-500/40',
  'flp': 'from-purple-500/20 to-pink-500/10 border-purple-500/20 hover:border-purple-500/40',
  'vst': 'from-warning/20 to-warning/10 border-warning/20 hover:border-warning/40',
  'preset': 'from-success/20 to-teal-500/10 border-success/20 hover:border-success/40',
  'instrument': 'from-rose-500/20 to-destructive/10 border-rose-500/20 hover:border-rose-500/40',
  'song-nhac-lyrics': 'from-info/20 to-violet-500/10 border-info/20 hover:border-info/40',
  'cai-dat-phan-mem': 'from-orange-500/20 to-amber-500/10 border-orange-500/20 hover:border-orange-500/40',
}

const iconColors: Record<string, string> = {
  'sample-pack': 'text-cyan-400', 'flp': 'text-purple-400', 'vst': 'text-warning',
  'preset': 'text-success', 'instrument': 'text-rose-400', 'song-nhac-lyrics': 'text-info',
  'cai-dat-phan-mem': 'text-orange-400',
}

interface CatStatsEntry { totalProducts: number; freeProducts: number; totalDownloads: number }

interface CategoriesContentProps {
  serverCatStats?: Record<string, CatStatsEntry> | null
}

export function CategoriesContent({ serverCatStats }: CategoriesContentProps) {
  const [catStats, setCatStats] = useState<Record<string, { totalProducts: number; freeProducts: number }>>(() => {
    if (serverCatStats) {
      const mapped: Record<string, { totalProducts: number; freeProducts: number }> = {}
      for (const [slug, s] of Object.entries(serverCatStats)) {
        mapped[slug] = { totalProducts: s.totalProducts, freeProducts: s.freeProducts }
      }
      return mapped
    }
    return {}
  })
  const [catDescs, setCatDescs] = useState<Record<string, string>>({})

  const refresh = useCallback(() => {
    setCatDescs(getCategoryDescriptions())
  }, [])

  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_category_descriptions') {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--glow),transparent_70%)]" />
        <div className="container relative mx-auto px-4 py-10 sm:py-14 text-center">
          <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary border-primary/20 text-xs">
            <Package className="h-3 w-3 mr-1" />
            Khám phá danh mục
          </Badge>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Danh mục sản phẩm</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            Tất cả tài nguyên sản xuất nhạc bạn cần: từ Sample Pack, FLP Project đến VST Plugin và nhiều hơn nữa.
          </p>
        </div>
      </div>

      {/* Categories grid */}
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {categoryMeta.map((cat) => {
            const Icon = categoryIcons[cat.slug] || Package
            const stats = catStats[cat.slug]
            const desc = catDescs[cat.slug] || cat.description
            const colorClass = categoryColors[cat.slug] || 'from-primary/20 to-primary/5 border-primary/20 hover:border-primary/40'
            const iconColor = iconColors[cat.slug] || 'text-primary'

            return (
              <Link key={cat.slug} href={`/danh-muc/${cat.slug}`} className="group block">
                <Card className={`bg-gradient-to-br ${colorClass} border transition-all duration-300 hover:shadow-glow-sm hover:-translate-y-0.5 h-full`}>
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-background/50 backdrop-blur-sm flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Icon className={`h-6 w-6 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-base sm:text-lg group-hover:text-primary transition-colors">
                          {cat.name}
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {desc}
                        </p>
                      </div>
                    </div>

                    {stats && (
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/30">
                        <div className="text-xs">
                          <span className="font-bold text-foreground">{stats.totalProducts}</span>
                          <span className="text-muted-foreground ml-1">sản phẩm</span>
                        </div>
                        <div className="text-xs">
                          <span className="font-bold text-success">{stats.freeProducts}</span>
                          <span className="text-muted-foreground ml-1">miễn phí</span>
                        </div>
                        <div className="ml-auto">
                          <span className="text-xs text-primary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                            Xem thêm <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* All products link */}
        <div className="text-center mt-8">
          <Link
            href="/san-pham"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/10 text-primary font-medium text-sm hover:bg-primary hover:text-primary-foreground transition-all border border-primary/20 hover:border-primary"
          >
            <Package className="h-4 w-4" />
            Xem tất cả sản phẩm
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
