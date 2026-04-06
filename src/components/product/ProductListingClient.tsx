'use client'

import { useState, useEffect, useCallback } from 'react'
import { getEffectiveProducts, type DemoProduct } from '@/lib/demo-data'
import { ProductGrid, type ProductGridItem } from '@/components/product/ProductGrid'

interface ProductListingClientProps {
  /** Server-fetched products from DB (empty array if DB unavailable) */
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
  categorySlug,
  typeFilter,
  isFree,
  sortKey = '-createdAt',
}: ProductListingClientProps) {
  const [clientProducts, setClientProducts] = useState<DemoProduct[]>([])

  const loadProducts = useCallback(() => {
    let data = getEffectiveProducts(categorySlug || typeFilter)
    // Apply type filter
    if (typeFilter && !categorySlug) {
      data = data.filter((p) => p.type === typeFilter)
    }
    // Apply price filter
    if (isFree === true) {
      data = data.filter((p) => p.pricing.isFree || p.pricing.price === 0)
    } else if (isFree === false) {
      data = data.filter((p) => !p.pricing.isFree && p.pricing.price > 0)
    }
    // Apply sort
    const desc = sortKey.startsWith('-')
    const field = sortKey.replace(/^-/, '')
    data.sort((a, b) => {
      let valueA: string | number = field === 'pricing.price' ? a.pricing.price : (a as unknown as Record<string, string | number>)[field] ?? 0
      let valueB: string | number = field === 'pricing.price' ? b.pricing.price : (b as unknown as Record<string, string | number>)[field] ?? 0
      if (typeof valueA === 'string') valueA = valueA.toLowerCase()
      if (typeof valueB === 'string') valueB = valueB.toLowerCase()
      return desc ? (valueB > valueA ? 1 : -1) : (valueA > valueB ? 1 : -1)
    })
    setClientProducts(data)
  }, [categorySlug, typeFilter, isFree, sortKey])

  useEffect(() => {
    if (!hasRealData) {
      loadProducts()
    }
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_products' || e.key === 'deleted_demo_products' || e.key === 'demo_product_overrides') {
        loadProducts()
      }
    }
    // Auto-refresh when tab becomes visible (user switches from admin tab)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !hasRealData) loadProducts()
    }
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [hasRealData, loadProducts])

  // Use server data if DB is available, otherwise use client-side localStorage-aware data
  const displayProducts = hasRealData ? serverProducts : clientProducts

  return <ProductGrid products={displayProducts} />
}
