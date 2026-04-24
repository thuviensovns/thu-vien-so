import { ProductCard } from '@/components/shared/ProductCard'
import { Package } from 'lucide-react'

/** Category-specific placeholder images */
const categoryPlaceholders: Record<string, string> = {
  'sample-pack': '/images/placeholder-sample-pack.svg',
  flp: '/images/placeholder-flp.svg',
  vst: '/images/placeholder-vst.svg',
  preset: '/images/placeholder-preset.svg',
  instrument: '/images/placeholder-instrument.svg',
  'song-nhac-lyrics': '/images/placeholder-song-nhac-lyrics.svg',
}

export interface ProductGridItem {
  id: string
  name: string
  slug: string
  type: string
  thumbnail: { url?: string } | string
  pricing: { price: number; originalPrice?: number | null; isFree?: boolean }
  preview?: { bpm?: number | null; musicalKey?: string | null } | null
  downloadCount?: number
  featured?: boolean
  outOfStock?: boolean
}

interface ProductGridProps {
  products: ProductGridItem[]
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-center animate-fade-in">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-base sm:text-lg font-medium text-foreground">Không tìm thấy sản phẩm</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xs">
          Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm khác
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
      {products.map((product, index) => {
        const rawUrl =
          typeof product.thumbnail === 'string'
            ? product.thumbnail
            : product.thumbnail?.url || ''
        const thumbnailUrl =
          rawUrl && !rawUrl.endsWith('/placeholder.jpg') && !rawUrl.endsWith('/placeholder.svg')
            ? rawUrl
            : categoryPlaceholders[product.type] || '/images/placeholder.svg'

        return (
          <div
            key={product.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
          >
            <ProductCard
              id={product.id}
              name={product.name}
              slug={product.slug}
              type={product.type}
              thumbnail={thumbnailUrl}
              price={product.pricing.price}
              originalPrice={product.pricing.originalPrice}
              isFree={product.pricing.isFree}
              downloadCount={product.downloadCount}
              bpm={product.preview?.bpm}
              musicalKey={product.preview?.musicalKey}
              featured={product.featured}
              outOfStock={product.outOfStock}
            />
          </div>
        )
      })}
    </div>
  )
}
