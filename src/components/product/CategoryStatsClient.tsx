'use client'

interface StatsResult {
  totalProducts: number
  freeProducts: number
  totalDownloads: number
}

interface CategoryStatsClientProps {
  categorySlug?: string
  children: (stats: StatsResult) => React.ReactNode
}

/** Removed demo data — now requires server stats passed via children render prop */
export function CategoryStatsClient({ categorySlug, children }: CategoryStatsClientProps) {
  return <>{children({ totalProducts: 0, freeProducts: 0, totalDownloads: 0 })}</>
}
