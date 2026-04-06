'use client'

import { useState, useEffect } from 'react'
import { getCategoryDescriptions } from '@/lib/demo-data'

/**
 * Client component that displays admin-configurable category description.
 * Falls back to server-provided default if no admin override exists.
 */
export function CategoryDescClient({ slug, fallback }: { slug: string; fallback: string }) {
  const [desc, setDesc] = useState(fallback)

  useEffect(() => {
    const descs = getCategoryDescriptions()
    if (descs[slug]) setDesc(descs[slug])

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_category_descriptions') {
        const updated = getCategoryDescriptions()
        setDesc(updated[slug] || fallback)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [slug, fallback])

  return <>{desc}</>
}
