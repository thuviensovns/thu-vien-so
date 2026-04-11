import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

import { getCategoryStats } from '@/lib/payload'
import { CategoriesContent } from '@/components/product/CategoriesContent'

export const metadata: Metadata = {
  title: 'Danh mục sản phẩm',
  description: 'Khám phá tất cả danh mục: Sample Pack, FLP Project, VST Plugin, Preset, Instrument và Sóng nhạc Lyrics',
}

export default async function CategoriesPage() {
  const catStatsMap = await getCategoryStats()
  return <CategoriesContent serverCatStats={catStatsMap} />
}
