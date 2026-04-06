'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  totalPages: number
  currentPage: number
}

export function Pagination({ totalPages, currentPage }: PaginationProps) {
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  function getPageUrl(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    return `?${params.toString()}`
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
  )

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-8 sm:mt-10 pt-6 border-t border-border/50" aria-label="Pagination">
      <Button
        variant="outline"
        size="sm"
        asChild={currentPage > 1}
        disabled={currentPage <= 1}
        className="h-9 px-3 rounded-lg text-xs gap-1"
      >
        {currentPage > 1 ? (
          <Link href={getPageUrl(currentPage - 1)} aria-label="Trang trước">
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Trước</span>
          </Link>
        ) : (
          <span>
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Trước</span>
          </span>
        )}
      </Button>

      {pages.map((page, i) => {
        const showEllipsis = i > 0 && page - pages[i - 1] > 1
        return (
          <span key={page} className="flex items-center gap-1.5">
            {showEllipsis && <span className="px-1 text-muted-foreground text-sm">...</span>}
            <Button
              variant={page === currentPage ? 'default' : 'outline'}
              size="icon"
              asChild
              className={`h-9 w-9 rounded-lg text-sm transition-all ${
                page === currentPage
                  ? 'bg-primary text-primary-foreground shadow-glow-sm'
                  : 'hover:border-primary/40'
              }`}
            >
              <Link href={getPageUrl(page)}>{page}</Link>
            </Button>
          </span>
        )
      })}

      <Button
        variant="outline"
        size="sm"
        asChild={currentPage < totalPages}
        disabled={currentPage >= totalPages}
        className="h-9 px-3 rounded-lg text-xs gap-1"
      >
        {currentPage < totalPages ? (
          <Link href={getPageUrl(currentPage + 1)} aria-label="Trang sau">
            <span className="hidden sm:inline">Sau</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span>
            <span className="hidden sm:inline">Sau</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </Button>
    </nav>
  )
}
