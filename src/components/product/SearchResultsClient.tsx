'use client'

import { useState, useEffect, useCallback } from 'react'
import { getEffectiveProducts, type DemoProduct } from '@/lib/demo-data'
import { ProductGrid, type ProductGridItem } from '@/components/product/ProductGrid'

interface SearchResultsClientProps {
  query: string
  serverProducts: ProductGridItem[]
  hasRealData: boolean
}

export function SearchResultsClient({ query, serverProducts, hasRealData }: SearchResultsClientProps) {
  const [clientResults, setClientResults] = useState<DemoProduct[]>([])

  const search = useCallback(() => {
    if (!query) { setClientResults([]); return }
    const q = query.toLowerCase()
    const all = getEffectiveProducts()
    const filtered = all.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.category?.name.toLowerCase().includes(q) ||
      p.tags?.some((t) => t.tag?.toLowerCase().includes(q))
    )
    setClientResults(filtered)
  }, [query])

  useEffect(() => {
    if (!hasRealData) search()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_products' || e.key === 'deleted_demo_products' || e.key === 'demo_product_overrides') {
        search()
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !hasRealData) search()
    }
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [hasRealData, search])

  const displayProducts = hasRealData ? serverProducts : clientResults

  return <ProductGrid products={displayProducts} />
}
