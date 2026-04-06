'use client'

import { useState, useEffect } from 'react'
import { getDemoProductBySlug, getEffectiveProducts, type DemoProduct } from '@/lib/demo-data'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft, Download, FileArchive, HardDrive, ChevronRight,
  Music, Headphones, Zap, Sliders, Guitar, Mic, Package, Eye, Shield, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import dynamic from 'next/dynamic'
import { PriceDisplay } from '@/components/shared/PriceDisplay'
import { ProductGrid } from '@/components/product/ProductGrid'
import { AddToCartButton } from '@/components/product/AddToCartButton'

const AudioPreview = dynamic(
  () => import('@/components/audio/AudioPreview').then((mod) => mod.AudioPreview),
  { ssr: false }
)
import { typeLabels } from '@/lib/config'
import { formatFileSize } from '@/lib/format'

const categoryIcons: Record<string, typeof Music> = {
  'sample-pack': Music, 'flp': Headphones, 'vst': Zap,
  'preset': Sliders, 'instrument': Guitar, 'song-nhac-lyrics': Mic,
}

interface ProductDetailClientProps {
  slug: string
  /** Server-fetched product (null if DB unavailable) */
  serverProduct: any | null
}

export function ProductDetailClient({ slug, serverProduct }: ProductDetailClientProps) {
  const [demoProduct, setDemoProduct] = useState<DemoProduct | null>(null)

  useEffect(() => {
    if (!serverProduct) {
      setDemoProduct(getDemoProductBySlug(slug))
    }
    const reload = () => {
      if (!serverProduct) setDemoProduct(getDemoProductBySlug(slug))
    }
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_products' || e.key === 'deleted_demo_products' || e.key === 'demo_product_overrides') {
        reload()
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') reload()
    }
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [slug, serverProduct])

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const p = serverProduct || demoProduct
  // Show nothing until client has tried loading from localStorage
  if (!p) {
    if (!mounted) return null
    // Client mounted but product not found — show not found
    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold">Không tìm thấy sản phẩm</h1>
        <p className="text-sm text-muted-foreground mt-2">Sản phẩm này không tồn tại hoặc đã bị xóa.</p>
        <Link href="/san-pham" className="mt-4 text-sm text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Về trang sản phẩm
        </Link>
      </div>
    )
  }

  const isDemo = !serverProduct && !!demoProduct

  const rawThumb = typeof p.thumbnail === 'object' && p.thumbnail?.url ? p.thumbnail.url : ''
  const thumbnailUrl = rawThumb && !rawThumb.endsWith('/placeholder.jpg') ? rawThumb : '/images/placeholder.jpg'

  const categorySlug =
    typeof p.category === 'object' && p.category?.slug ? p.category.slug : ''
  const categoryName =
    typeof p.category === 'object' && p.category?.name ? p.category.name : ''

  const isFreeItem = p.pricing.isFree || p.pricing.price === 0
  const hasDiscount = p.pricing.originalPrice && p.pricing.originalPrice > p.pricing.price
  const discountPercent = hasDiscount ? Math.round((1 - p.pricing.price / p.pricing.originalPrice!) * 100) : 0

  // Related products from effective products (localStorage-aware)
  const relatedProducts = categorySlug
    ? getEffectiveProducts(categorySlug).filter((rp) => rp.id !== p.id).slice(0, 4)
    : []

  const CatIcon = categoryIcons[categorySlug] || Package

  return (
    <div className="min-h-screen">
      {/* Breadcrumb header */}
      <div className="border-b border-border bg-card/30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground overflow-x-auto">
            <Link href="/" className="hover:text-primary transition-colors shrink-0">Trang chủ</Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <Link href="/san-pham" className="hover:text-primary flex items-center gap-1 shrink-0">Sản phẩm</Link>
            {categorySlug && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <Link href={`/danh-muc/${categorySlug}`} className="hover:text-primary shrink-0 flex items-center gap-1">
                  <CatIcon className="h-3 w-3" />
                  {categoryName}
                </Link>
              </>
            )}
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground truncate">{p.name}</span>
          </nav>
          <Link
            href={categorySlug ? `/danh-muc/${categorySlug}` : '/san-pham'}
            className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline">{categorySlug ? `Về ${categoryName}` : 'Về sản phẩm'}</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-5 sm:py-8">
        {isDemo && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs">
            Đang hiển thị dữ liệu demo. Kết nối database để xem dữ liệu thật.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Left: Image — 3 cols */}
          <div className="lg:col-span-3">
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-border bg-muted/20">
              <Image
                src={thumbnailUrl}
                alt={p.name}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                <Badge className="bg-black/60 backdrop-blur-sm border-0 text-white text-xs px-2.5 py-1">
                  <CatIcon className="h-3 w-3 mr-1" />
                  {typeLabels[p.type] || p.type}
                </Badge>
                {p.featured && (
                  <Badge className="bg-gradient-to-r from-warning to-warning border-0 text-white text-xs px-2.5 py-1">
                    Hot
                  </Badge>
                )}
              </div>
              {isFreeItem ? (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-success border-0 text-white text-sm px-3 py-1 font-bold">FREE</Badge>
                </div>
              ) : hasDiscount ? (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-destructive border-0 text-white text-sm px-3 py-1 font-bold">-{discountPercent}%</Badge>
                </div>
              ) : null}
              {(p.preview?.bpm || p.preview?.musicalKey) && (
                <div className="absolute bottom-3 left-3 flex gap-1.5">
                  {p.preview.bpm && (
                    <Badge variant="outline" className="bg-black/60 backdrop-blur-sm border-0 text-white text-xs font-mono px-2 py-0.5">
                      {p.preview.bpm} BPM
                    </Badge>
                  )}
                  {p.preview.musicalKey && (
                    <Badge variant="outline" className="bg-black/60 backdrop-blur-sm border-0 text-xs font-mono text-secondary px-2 py-0.5">
                      {p.preview.musicalKey}
                    </Badge>
                  )}
                </div>
              )}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 text-white text-[10px]">
                <Download className="h-3 w-3" />
                <span>{p.downloadCount || 0} lượt tải</span>
              </div>
            </div>

            {/* Audio Preview */}
            {p.preview?.audioFile && (() => {
              const audioUrl =
                typeof p.preview.audioFile === 'object' && p.preview.audioFile?.url
                  ? p.preview.audioFile.url : null
              return audioUrl ? (
                <div className="mt-4">
                  <AudioPreview src={audioUrl} bpm={p.preview?.bpm} musicalKey={p.preview?.musicalKey} duration={p.preview?.duration} />
                </div>
              ) : null
            })()}

            {/* Description */}
            <div className="mt-6">
              <h2 className="text-lg font-bold mb-3">Mô tả sản phẩm</h2>
              <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed">
                <p>
                  <strong>{p.name}</strong> là {typeLabels[p.type]?.toLowerCase() || 'sản phẩm'} chất lượng cao
                  dành cho các DAW phổ biến.
                  {p.preview?.bpm && ` Tempo: ${p.preview.bpm} BPM.`}
                  {p.preview?.musicalKey && ` Key: ${p.preview.musicalKey}.`}
                </p>
                <p>
                  Sản phẩm đã được kiểm tra chất lượng và tương thích với các DAW phiên bản mới nhất.
                  Sau khi mua, bạn sẽ nhận được link download ngay lập tức.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Info — 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge variant="secondary" className="bg-secondary/20 text-secondary text-xs">
                  {typeLabels[p.type] || p.type}
                </Badge>
                {p.featured && (
                  <Badge className="bg-accent/20 text-accent text-xs">Nổi bật</Badge>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight">{p.name}</h1>
              {categorySlug && (
                <Link
                  href={`/danh-muc/${categorySlug}`}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <CatIcon className="h-3 w-3" />
                  {categoryName}
                </Link>
              )}
            </div>

            {/* Price section */}
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <PriceDisplay
                    price={p.pricing.price}
                    originalPrice={p.pricing.originalPrice}
                    isFree={p.pricing.isFree || false}
                    size="lg"
                  />
                  {hasDiscount && (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                      Tiết kiệm {discountPercent}%
                    </Badge>
                  )}
                </div>
                <div className="mt-4">
                  <AddToCartButton
                    id={String(p.id)}
                    name={p.name}
                    slug={slug}
                    price={p.pricing.price}
                    thumbnail={thumbnailUrl}
                    type={p.type}
                    isFree={isFreeItem}
                  />
                </div>
              </CardContent>
            </Card>

            {/* File info */}
            <Card className="border-border bg-card/50">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileArchive className="h-4 w-4 text-primary" />
                  Thông tin file
                </h3>
                <div className="grid grid-cols-1 gap-2.5">
                  {p.file?.fileFormat && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Định dạng</span>
                      <span className="font-medium">{p.file.fileFormat.toUpperCase()}</span>
                    </div>
                  )}
                  {p.file?.fileSize && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dung lượng</span>
                      <span className="font-medium">{formatFileSize(p.file.fileSize)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Lượt tải</span>
                    <span className="font-medium flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {p.downloadCount || 0}
                    </span>
                  </div>
                  {p.preview?.bpm && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">BPM</span>
                      <span className="font-medium font-mono">{p.preview.bpm}</span>
                    </div>
                  )}
                  {p.preview?.musicalKey && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Key</span>
                      <span className="font-medium font-mono text-secondary">{p.preview.musicalKey}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Compatibility */}
            {p.compatibility && p.compatibility.length > 0 && (
              <Card className="border-border bg-card/50">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-2">Tương thích</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {p.compatibility.map((comp: { daw?: string; version?: string }, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {comp.daw} {comp.version && `v${comp.version}`}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            {p.tags && p.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {p.tags.map((t: { tag?: string }, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs text-muted-foreground">
                    #{t.tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Trust signals */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-success shrink-0" />
                  <span>An toàn & đã kiểm tra virus</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Download className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Download tốc độ cao, không giới hạn</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                  <span>Hỗ trợ kỹ thuật 24/7</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <>
            <Separator className="my-8 sm:my-10" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold">Sản phẩm liên quan</h2>
                {categorySlug && (
                  <Link href={`/danh-muc/${categorySlug}`} className="text-xs sm:text-sm text-primary hover:underline">
                    Xem tất cả →
                  </Link>
                )}
              </div>
              <ProductGrid products={relatedProducts} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
