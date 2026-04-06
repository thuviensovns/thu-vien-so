'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'

const sortOptions = [
  { label: 'Mới nhất', value: '-createdAt' },
  { label: 'Phổ biến nhất', value: '-downloadCount' },
  { label: 'Giá thấp → cao', value: 'pricing.price' },
  { label: 'Giá cao → thấp', value: '-pricing.price' },
  { label: 'Tên A → Z', value: 'name' },
]

export function ProductSort() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentSort = searchParams.get('sort') || '-createdAt'

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', value)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">Sắp xếp:</span>
      <select
        value={currentSort}
        onChange={(e) => handleSort(e.target.value)}
        className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs sm:text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none cursor-pointer appearance-none pr-8 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
