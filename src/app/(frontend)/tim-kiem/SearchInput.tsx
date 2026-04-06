'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SearchInput({ defaultQuery = '' }: { defaultQuery?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultQuery)

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const q = query.trim()
    if (q) {
      router.push(`/tim-kiem?q=${encodeURIComponent(q)}`)
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Nhập tên sản phẩm, thể loại, từ khóa..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 pr-9 bg-card border-border focus:border-primary h-11 text-sm"
          autoFocus={!defaultQuery}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); router.push('/tim-kiem') }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-5">
        <Search className="h-4 w-4 mr-1.5" />
        Tìm kiếm
      </Button>
    </form>
  )
}
