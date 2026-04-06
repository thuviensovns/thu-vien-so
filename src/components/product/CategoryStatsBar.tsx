'use client'

import { useState, useEffect } from 'react'
import { Separator } from '@/components/ui/separator'

interface StatsResult {
  totalProducts: number
  freeProducts: number
  totalDownloads: number
}

interface CategoryStatsBarProps {
  categorySlug?: string
  /** Real stats from server — when provided, demo data is ignored */
  serverStats?: StatsResult
}

export function CategoryStatsBar({ categorySlug, serverStats }: CategoryStatsBarProps) {
  const [stats, setStats] = useState<StatsResult>(serverStats || { totalProducts: 0, freeProducts: 0, totalDownloads: 0 })

  useEffect(() => {
    if (serverStats) {
      setStats(serverStats)
    }
  }, [serverStats])

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="text-center px-3 sm:px-4">
        <p className="text-lg sm:text-xl font-bold text-foreground">{stats.totalProducts}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Sản phẩm</p>
      </div>
      <Separator orientation="vertical" className="h-8" />
      <div className="text-center px-3 sm:px-4">
        <p className="text-lg sm:text-xl font-bold text-success">{stats.freeProducts}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Miễn phí</p>
      </div>
      <Separator orientation="vertical" className="h-8" />
      <div className="text-center px-3 sm:px-4">
        <p className="text-lg sm:text-xl font-bold text-primary">
          {stats.totalDownloads >= 1000 ? `${(stats.totalDownloads / 1000).toFixed(1)}K` : stats.totalDownloads}
        </p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Lượt tải</p>
      </div>
    </div>
  )
}

interface CategoryStatsCountProps {
  categorySlug: string
  /** Real count from server */
  serverCount?: number
}

export function CategoryStatsCount({ categorySlug, serverCount }: CategoryStatsCountProps) {
  const [count, setCount] = useState(serverCount ?? 0)

  useEffect(() => {
    if (serverCount !== undefined) {
      setCount(serverCount)
    }
  }, [serverCount])

  return <p className="text-[10px] text-muted-foreground mt-1">{count} sản phẩm</p>
}
