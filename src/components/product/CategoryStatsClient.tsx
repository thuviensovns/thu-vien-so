'use client'

import { useState, useEffect } from 'react'
import { getEffectiveProducts } from '@/lib/demo-data'

interface StatsResult {
  totalProducts: number
  freeProducts: number
  totalDownloads: number
}

function computeFromEffective(categorySlug?: string): StatsResult {
  const products = getEffectiveProducts(categorySlug)
  let totalProducts = 0, freeProducts = 0, totalDownloads = 0
  for (const p of products) {
    totalProducts++
    if (p.pricing.isFree || p.pricing.price === 0) freeProducts++
    totalDownloads += p.downloadCount || 0
  }
  return { totalProducts, freeProducts, totalDownloads }
}

interface CategoryStatsClientProps {
  categorySlug?: string
  children: (stats: StatsResult) => React.ReactNode
}

export function CategoryStatsClient({ categorySlug, children }: CategoryStatsClientProps) {
  const [stats, setStats] = useState<StatsResult>({ totalProducts: 0, freeProducts: 0, totalDownloads: 0 })

  useEffect(() => {
    setStats(computeFromEffective(categorySlug))
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_products' || e.key === 'deleted_demo_products' || e.key === 'demo_product_overrides') {
        setStats(computeFromEffective(categorySlug))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [categorySlug])

  return <>{children(stats)}</>
}
