'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AdminPaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

export default function AdminPagination({
  currentPage, totalPages, totalItems, itemsPerPage, onPageChange,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
  )

  return (
    <div className="flex items-center justify-between pt-4 border-t border-border/50">
      <span className="text-xs text-muted-foreground">
        {startItem}–{endItem} / {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline" size="icon"
          className="h-7 w-7"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {pages.map((page, i) => {
          const showEllipsis = i > 0 && page - pages[i - 1] > 1
          return (
            <span key={page} className="flex items-center gap-1">
              {showEllipsis && <span className="px-0.5 text-muted-foreground text-xs">...</span>}
              <Button
                variant={page === currentPage ? 'default' : 'outline'}
                size="icon"
                className={`h-7 w-7 text-xs ${page === currentPage ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            </span>
          )
        })}
        <Button
          variant="outline" size="icon"
          className="h-7 w-7"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/** Helper: trả về phần dữ liệu cho trang hiện tại */
export function paginate<T>(items: T[], page: number, perPage: number): { paged: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * perPage
  return { paged: items.slice(start, start + perPage), totalPages }
}
