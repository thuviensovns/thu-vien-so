'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function SearchBar() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  const handleSearch = useCallback(() => {
    const q = query.trim()
    if (q) {
      router.push(`/tim-kiem?q=${encodeURIComponent(q)}`)
      setQuery('')
      inputRef.current?.blur()
    }
  }, [query, router])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur()
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
          className="w-48 lg:w-64 pl-9 pr-12 bg-muted/50 border-border focus:border-primary focus:ring-primary/20 transition-all"
        />
        {query ? (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground z-10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-background border border-border rounded">
            ⌘K
          </kbd>
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
