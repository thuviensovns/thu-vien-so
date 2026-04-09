'use client'

import { ProductGrid, type ProductGridItem } from '@/components/product/ProductGrid'

interface ProductListingClientProps {
  /** Server-fetched products from DB */
  serverProducts: ProductGridItem[]
  /** Whether server had real data from DB */
  hasRealData: boolean
  /** Category slug filter */
  categorySlug?: string
  /** Type filter */
  typeFilter?: string
  /** Free filter: true=free only, false=paid only, undefined=all */
  isFree?: boolean
  /** Sort key like '-createdAt' */
  sortKey?: string
}

export function ProductListingClient({
  serverProducts,
  hasRealData,
}: ProductListingClientProps) {
  return <ProductGrid products={serverProducts} />
}
