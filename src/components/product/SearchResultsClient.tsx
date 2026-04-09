'use client'

import { ProductGrid, type ProductGridItem } from '@/components/product/ProductGrid'

interface SearchResultsClientProps {
  query: string
  serverProducts: ProductGridItem[]
  hasRealData: boolean
}

export function SearchResultsClient({ query, serverProducts, hasRealData }: SearchResultsClientProps) {
  return <ProductGrid products={serverProducts} />
}
