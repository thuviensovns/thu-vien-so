'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getDemoProducts } from '@/lib/demo-data'
import { typeLabels } from '@/lib/config'
import { formatVND } from '@/lib/format'

export function SearchBar() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [suggestions, setSuggestions] = useState<ReturnType<typeof getDemoProducts>>([])

  const handleSearch = useCallback(() => {
    const q = query.trim()
    if (q) {
      router.push(`/tim-kiem?q=${encodeURIComponent(q)}`)
      setQuery('')
      setIsExpanded(false)
      setSuggestions([])
      inputRef.current?.blur()
    }
  }, [query, router])

  // Live suggestions from demo data
  useEffect(() => {
    if (query.trim().length >= 2) {
      const q = query.trim().toLowerCase()
      const allProducts = getDemoProducts()
      const matches = allProducts
        .filter((p) =>
          p.name.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.tag?.toLowerCase().includes(q))
        )
        .slice(0, 5)
      setSuggestions(matches)
    } else {
      setSuggestions([])
    }
  }, [query])

  function selectSuggestion(slug: string) {
    setQuery('')
    setIsExpanded(false)
    setSuggestions([])
    router.push(`/san-pham/${slug}`)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsExpanded(true)
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur()
        setIsExpanded(false)
        setSuggestions([])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      {/* Desktop search */}
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        <Input
          ref={inputRef}
          placeholder="Tìm kiếm sample, plugin..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => setTimeout(() => { setIsExpanded(false); setSuggestions([]) }, 250)}
          className="w-48 lg:w-64 pl-9 pr-12 bg-muted/50 border-border focus:border-primary focus:ring-primary/20 transition-all"
        />
        {query ? (
          <button
            onClick={() => { setQuery(''); setSuggestions([]) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground z-10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-background border border-border rounded">
            ⌘K
          </kbd>
        )}

        {/* Suggestions dropdown */}
        {isExpanded && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
            {suggestions.map((p) => (
              <button
                key={p.id}
                onMouseDown={() => selectSuggestion(p.slug)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              >
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {typeLabels[p.type] || p.type}
                    {p.pricing.isFree || p.pricing.price === 0 ? ' · Miễn phí' : ` · ${formatVND(p.pricing.price)}`}
                  </p>
                </div>
              </button>
            ))}
            <button
              onMouseDown={handleSearch}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary font-medium border-t border-border hover:bg-primary/5 transition-colors"
            >
              <Search className="h-3 w-3" />
              Tìm kiếm "{query}"
            </button>
          </div>
        )}
      </div>

      {/* Mobile search button */}
      <button
        onClick={() => router.push('/tim-kiem')}
        className="md:hidden p-2 text-muted-foreground hover:text-primary transition-colors"
        aria-label="Tìm kiếm"
      >
        <Search className="h-5 w-5" />
      </button>
    </>
  )
}
