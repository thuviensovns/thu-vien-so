'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { typeLabels } from '@/lib/config'

const productTypes = Object.entries(typeLabels).map(([value, label]) => ({ value, label }))

const priceFilters = [
  { label: 'Tất cả', value: '' },
  { label: 'Miễn phí', value: 'free' },
  { label: 'Trả phí', value: 'paid' },
]

export function ProductFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentType = searchParams.get('type') || ''
  const currentPrice = searchParams.get('price') || ''
  const [mobileOpen, setMobileOpen] = useState(false)

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  function clearFilters() {
    router.push(window.location.pathname)
  }

  const hasFilters = currentType || currentPrice
  const activeCount = (currentType ? 1 : 0) + (currentPrice ? 1 : 0)

  const filterContent = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Filter className="h-3.5 w-3.5 text-primary" />
          </div>
          Bộ lọc
          {activeCount > 0 && (
            <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px] bg-primary text-primary-foreground">
              {activeCount}
            </Badge>
          )}
        </h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-destructive h-7 px-2">
            <X className="h-3 w-3 mr-1" />
            Xóa lọc
          </Button>
        )}
      </div>

      <Separator className="opacity-50" />

      {/* Type filter */}
      <div>
        <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Loại sản phẩm</h4>
        <div className="space-y-1">
          <button
            onClick={() => updateFilter('type', '')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
              !currentType
                ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            Tất cả loại
          </button>
          {productTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => updateFilter('type', type.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                currentType === type.value
                  ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Price filter */}
      <div>
        <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Mức giá</h4>
        <div className="flex flex-wrap gap-2">
          {priceFilters.map((pf) => (
            <button
              key={pf.value || 'all'}
              onClick={() => updateFilter('price', pf.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                currentPrice === pf.value
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
              }`}
            >
              {pf.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile: collapsible */}
      <div className="lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full justify-between text-sm h-10 rounded-lg border-border"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Bộ lọc
            {activeCount > 0 && (
              <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px] bg-primary text-primary-foreground">
                {activeCount}
              </Badge>
            )}
          </span>
          {mobileOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <div className={`transition-all duration-300 overflow-hidden ${mobileOpen ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
          <aside className="p-4 rounded-xl border border-border bg-card">
            {filterContent}
          </aside>
        </div>
      </div>

      {/* Desktop: sidebar */}
      <aside className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-[4.5rem] p-4 rounded-xl border border-border bg-card">
          {filterContent}
        </div>
      </aside>
    </>
  )
}
