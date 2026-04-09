import { categoryMeta } from '@/lib/config'

/** Demo product data for when Payload CMS / DB is unavailable */

export interface DemoProduct {
  id: string
  name: string
  slug: string
  type: string
  thumbnail: { url: string }
  pricing: { price: number; originalPrice?: number | null; isFree?: boolean }
  preview?: { bpm?: number | null; musicalKey?: string | null }
  downloadCount: number
  featured?: boolean
  category?: { slug: string; name: string }
  file?: { r2Key?: string; fileName?: string; fileSize?: number; fileFormat?: string; downloadUrl?: string }
  compatibility?: { daw?: string; version?: string }[]
  tags?: { tag?: string }[]
  updatedAt: string
}

const demoProducts: DemoProduct[] = [
  // Sóng nhạc Lyrics (cập nhật gần nhất: 2026-04-01)
  { id: 'snl-1', name: 'Sóng nhạc Ballad Việt Pack', slug: 'song-nhac-ballad-viet', type: 'song-nhac-lyrics', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 99000 }, downloadCount: 890, featured: true, category: { slug: 'song-nhac-lyrics', name: 'Sóng nhạc Lyrics' }, updatedAt: '2026-04-01' },
  { id: 'snl-2', name: 'Lyrics Video Template Pack', slug: 'lyrics-video-template', type: 'song-nhac-lyrics', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 0, isFree: true }, downloadCount: 2300, category: { slug: 'song-nhac-lyrics', name: 'Sóng nhạc Lyrics' }, updatedAt: '2026-03-28' },
  { id: 'snl-3', name: 'Karaoke Wave Effect Bundle', slug: 'karaoke-wave-effect', type: 'song-nhac-lyrics', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 149000, originalPrice: 249000 }, downloadCount: 560, category: { slug: 'song-nhac-lyrics', name: 'Sóng nhạc Lyrics' }, updatedAt: '2026-03-20' },

  // VST Plugins (cập nhật gần nhất: 2026-03-30)
  { id: 'vst-1', name: 'Nexus 4 Full Bank', slug: 'nexus-4-full-bank', type: 'vst', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 499000, originalPrice: 799000 }, downloadCount: 2300, featured: true, category: { slug: 'vst', name: 'VST Plugin' }, file: { fileFormat: 'zip', fileSize: 2147483648 }, updatedAt: '2026-03-30' },
  { id: 'vst-2', name: 'Serum Preset Pack + Skin', slug: 'serum-preset-pack-skin', type: 'vst', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 299000 }, downloadCount: 1800, category: { slug: 'vst', name: 'VST Plugin' }, updatedAt: '2026-03-22' },
  { id: 'vst-3', name: 'Spire Full Collection', slug: 'spire-full-collection', type: 'vst', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 399000, originalPrice: 599000 }, downloadCount: 945, category: { slug: 'vst', name: 'VST Plugin' }, updatedAt: '2026-03-15' },
  { id: 'vst-4', name: 'Kontakt Library Essential', slug: 'kontakt-library-essential', type: 'vst', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 0, isFree: true }, downloadCount: 6700, category: { slug: 'vst', name: 'VST Plugin' }, updatedAt: '2026-03-10' },

  // FLP Projects (cập nhật gần nhất: 2026-03-27)
  { id: 'flp-1', name: 'Vinahouse Full Project 2024', slug: 'vinahouse-full-project-2024', type: 'flp', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 299000, originalPrice: 499000 }, preview: { bpm: 130, musicalKey: 'Am' }, downloadCount: 890, featured: true, category: { slug: 'flp', name: 'FLP Project' }, file: { fileFormat: 'flp', fileSize: 125829120 }, updatedAt: '2026-03-27' },
  { id: 'flp-2', name: 'Future Bass FLP Template', slug: 'future-bass-flp-template', type: 'flp', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 0, isFree: true }, preview: { bpm: 150, musicalKey: 'Cm' }, downloadCount: 5600, category: { slug: 'flp', name: 'FLP Project' }, updatedAt: '2026-03-18' },
  { id: 'flp-3', name: 'Tropical House FL Studio Project', slug: 'tropical-house-flp', type: 'flp', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 199000 }, preview: { bpm: 110, musicalKey: 'Gm' }, downloadCount: 1200, category: { slug: 'flp', name: 'FLP Project' }, updatedAt: '2026-03-12' },
  { id: 'flp-4', name: 'Remix Mashup FLP Pack', slug: 'remix-mashup-flp', type: 'flp', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 349000 }, preview: { bpm: 128 }, downloadCount: 430, category: { slug: 'flp', name: 'FLP Project' }, updatedAt: '2026-03-05' },

  // Preset (cập nhật gần nhất: 2026-03-25)
  { id: 'pr-1', name: 'Sylenth1 EDM Preset Pack', slug: 'sylenth1-edm-preset', type: 'preset', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 149000 }, downloadCount: 1450, featured: true, category: { slug: 'preset', name: 'Preset' }, updatedAt: '2026-03-25' },
  { id: 'pr-2', name: 'Massive X Trap Presets', slug: 'massive-x-trap-presets', type: 'preset', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 0, isFree: true }, downloadCount: 3200, category: { slug: 'preset', name: 'Preset' }, updatedAt: '2026-03-14' },
  { id: 'pr-3', name: 'Serum Future House Pack', slug: 'serum-future-house', type: 'preset', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 199000, originalPrice: 299000 }, downloadCount: 780, category: { slug: 'preset', name: 'Preset' }, updatedAt: '2026-03-08' },

  // Sample Packs (cập nhật gần nhất: 2026-03-20)
  { id: 'sp-1', name: 'Vinahouse Drum Kit Vol.1', slug: 'vinahouse-drum-kit-vol1', type: 'sample-pack', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 199000, originalPrice: 299000 }, preview: { bpm: 130, musicalKey: 'Am' }, downloadCount: 1234, featured: true, category: { slug: 'sample-pack', name: 'Sample Pack' }, file: { fileFormat: 'wav', fileSize: 524288000 }, tags: [{ tag: 'vinahouse' }, { tag: 'drum' }], updatedAt: '2026-03-20' },
  { id: 'sp-2', name: 'Lo-Fi Hip Hop Sample Pack', slug: 'lofi-hiphop-sample-pack', type: 'sample-pack', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 0, isFree: true }, preview: { bpm: 85, musicalKey: 'Cm' }, downloadCount: 3456, category: { slug: 'sample-pack', name: 'Sample Pack' }, tags: [{ tag: 'lofi' }, { tag: 'hiphop' }], updatedAt: '2026-03-16' },
  { id: 'sp-3', name: 'Trap Melody Loops Pack', slug: 'trap-melody-loops', type: 'sample-pack', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 149000 }, preview: { bpm: 140, musicalKey: 'Dm' }, downloadCount: 892, category: { slug: 'sample-pack', name: 'Sample Pack' }, tags: [{ tag: 'trap' }, { tag: 'melody' }], updatedAt: '2026-03-10' },
  { id: 'sp-4', name: 'EDM Future Bass Samples', slug: 'edm-future-bass-samples', type: 'sample-pack', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 249000, originalPrice: 349000 }, preview: { bpm: 150 }, downloadCount: 567, featured: true, category: { slug: 'sample-pack', name: 'Sample Pack' }, tags: [{ tag: 'edm' }, { tag: 'future bass' }], updatedAt: '2026-03-02' },
  { id: 'sp-5', name: 'Vocal Chop Collection', slug: 'vocal-chop-collection', type: 'sample-pack', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 99000 }, preview: { bpm: 128 }, downloadCount: 2100, category: { slug: 'sample-pack', name: 'Sample Pack' }, updatedAt: '2026-02-25' },
  { id: 'sp-6', name: 'Deep House Percussion Kit', slug: 'deep-house-percussion', type: 'sample-pack', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 0, isFree: true }, preview: { bpm: 124, musicalKey: 'Fm' }, downloadCount: 4500, category: { slug: 'sample-pack', name: 'Sample Pack' }, updatedAt: '2026-02-18' },

  // Instruments (cập nhật gần nhất: 2026-03-08)
  { id: 'ins-1', name: 'Ample Guitar M Lite', slug: 'ample-guitar-m-lite', type: 'instrument', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 0, isFree: true }, downloadCount: 4200, featured: true, category: { slug: 'instrument', name: 'Instrument' }, updatedAt: '2026-03-08' },
  { id: 'ins-2', name: 'SWAM Violin Full', slug: 'swam-violin-full', type: 'instrument', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 599000 }, downloadCount: 340, category: { slug: 'instrument', name: 'Instrument' }, updatedAt: '2026-02-28' },
  { id: 'ins-3', name: 'Piano Collection Kontakt', slug: 'piano-collection-kontakt', type: 'instrument', thumbnail: { url: '/images/placeholder.svg' }, pricing: { price: 349000, originalPrice: 499000 }, downloadCount: 1100, category: { slug: 'instrument', name: 'Instrument' }, updatedAt: '2026-02-15' },
]

export function getDemoProducts(categorySlug?: string): DemoProduct[] {
  const products = categorySlug
    ? demoProducts.filter((p) => p.category?.slug === categorySlug)
    : demoProducts
  return [...products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getDemoProductBySlug(slug: string): DemoProduct | null {
  // On client, check overrides first
  if (typeof window !== 'undefined') {
    try {
      const deletedIds: string[] = JSON.parse(localStorage.getItem('deleted_demo_products') || '[]')
      const overrides: Record<string, Partial<DemoProduct>> = JSON.parse(localStorage.getItem('demo_product_overrides') || '{}')
      // Check admin products too
      const adminProducts: DemoProduct[] = JSON.parse(localStorage.getItem('admin_products') || '[]')
      const adminMatch = adminProducts.find((p) => p.slug === slug)
      if (adminMatch) return adminMatch

      const demo = demoProducts.find((p) => p.slug === slug)
      if (!demo) {
        // Maybe slug was changed via override
        for (const [id, ov] of Object.entries(overrides)) {
          if (ov.slug === slug) {
            const original = demoProducts.find((p) => p.id === id)
            if (original && !deletedIds.includes(id)) {
              return { ...original, ...ov, pricing: ov.pricing ? { ...original.pricing, ...ov.pricing } : original.pricing } as DemoProduct
            }
          }
        }
        return null
      }
      if (deletedIds.includes(demo.id)) return null
      const override = overrides[demo.id]
      if (override) {
        return { ...demo, ...override, pricing: override.pricing ? { ...demo.pricing, ...override.pricing } : demo.pricing } as DemoProduct
      }
      return demo
    } catch {}
  }
  return demoProducts.find((p) => p.slug === slug) || null
}

/**
 * Get demo products with admin overrides & deletions applied (client-aware).
 * On server, returns original demo products unchanged.
 */
export function getEffectiveProducts(categorySlug?: string): DemoProduct[] {
  if (typeof window === 'undefined') return getDemoProducts(categorySlug)
  try {
    const deletedIds: string[] = JSON.parse(localStorage.getItem('deleted_demo_products') || '[]')
    const overrides: Record<string, Partial<DemoProduct>> = JSON.parse(localStorage.getItem('demo_product_overrides') || '{}')
    const adminProducts: DemoProduct[] = JSON.parse(localStorage.getItem('admin_products') || '[]')

    let products = demoProducts
      .filter((p) => !deletedIds.includes(p.id))
      .map((p) => {
        const ov = overrides[p.id]
        if (ov) return { ...p, ...ov, pricing: ov.pricing ? { ...p.pricing, ...ov.pricing } : p.pricing } as DemoProduct
        return p
      })

    products = [...adminProducts, ...products]
    if (categorySlug) products = products.filter((p) => p.category?.slug === categorySlug || p.type === categorySlug)
    return products.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch {
    return getDemoProducts(categorySlug)
  }
}

export const demoCategoryDescriptions: Record<string, string> = {
  'sample-pack': 'Bộ sưu tập âm thanh chất lượng cao: Drum Kit, Melody Loop, One-shot, FX và nhiều hơn nữa cho mọi thể loại nhạc.',
  'flp': 'File project FL Studio hoàn chỉnh, sẵn sàng mở và học hỏi kỹ thuật mixing, mastering từ các producer chuyên nghiệp.',
  'vst': 'Plugin âm thanh chuyên nghiệp: Synthesizer, Effect, Instrument cho các DAW phổ biến.',
  'preset': 'Preset chất lượng cao cho Serum, Sylenth1, Massive, Spire và các synth phổ biến khác.',
  'instrument': 'Nhạc cụ ảo chuyên nghiệp: Guitar, Piano, Violin, Drum và nhiều nhạc cụ khác cho sản xuất âm nhạc.',
  'song-nhac-lyrics': 'Sóng nhạc, hiệu ứng lyrics video, template karaoke và các tài nguyên cho sản xuất video âm nhạc.',
}

/** Get admin-overridden category descriptions (client-only, reads localStorage) */
export function getCategoryDescriptions(): Record<string, string> {
  if (typeof window === 'undefined') return demoCategoryDescriptions
  try {
    const raw = localStorage.getItem('admin_category_descriptions')
    return raw ? { ...demoCategoryDescriptions, ...JSON.parse(raw) } : demoCategoryDescriptions
  } catch {
    return demoCategoryDescriptions
  }
}

/** Debounced DB sync for category descriptions */
let _catDescsDbTimer: ReturnType<typeof setTimeout> | null = null

function syncCatDescsToDb(descs: Record<string, string>) {
  if (_catDescsDbTimer) clearTimeout(_catDescsDbTimer)
  _catDescsDbTimer = setTimeout(() => {
    fetch('/api/site-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ categoryDescriptions: descs }),
    }).then(res => {
      if (!res.ok) console.warn('[SiteContent] DB category save failed:', res.status)
    }).catch(() => {
      console.warn('[SiteContent] DB category save failed: network error')
    })
  }, 1500)
}

/** Save admin category description overrides — localStorage instant, DB debounced */
export function saveCategoryDescriptions(descs: Record<string, string>) {
  try {
    localStorage.setItem('admin_category_descriptions', JSON.stringify(descs))
    window.dispatchEvent(new StorageEvent('storage', { key: 'admin_category_descriptions' }))
  } catch {}
  syncCatDescsToDb(descs)
}

/** Compute category stats from an array of products */
function computeCategoryStats(
  products: Array<{ category?: { slug: string }; pricing: { isFree?: boolean; price: number }; downloadCount: number }>
): Record<string, { totalProducts: number; freeProducts: number; totalDownloads: number }> {
  const stats: Record<string, { totalProducts: number; freeProducts: number; totalDownloads: number }> = {}
  for (const p of products) {
    const slug = p.category?.slug
    if (!slug) continue
    if (!stats[slug]) stats[slug] = { totalProducts: 0, freeProducts: 0, totalDownloads: 0 }
    stats[slug].totalProducts += 1
    if (p.pricing.isFree || p.pricing.price === 0) stats[slug].freeProducts += 1
    stats[slug].totalDownloads += p.downloadCount || 0
  }
  return stats
}

/** Stats computed from hardcoded demo products only (safe for server components) */
export const demoCategoryStats = computeCategoryStats(demoProducts)

/** Get the most recent updatedAt date for each category slug */
export function getCategoryLatestUpdate(): Record<string, string> {
  const latest: Record<string, string> = {}
  for (const p of demoProducts) {
    const slug = p.category?.slug
    if (slug && (!latest[slug] || p.updatedAt > latest[slug])) {
      latest[slug] = p.updatedAt
    }
  }
  return latest
}

/** Return categoryMeta sorted by most recently updated category first */
export function getCategoryMetaSorted() {
  const latest = getCategoryLatestUpdate()
  return [...categoryMeta].sort((a, b) => {
    const dateA = latest[a.slug] || '2000-01-01'
    const dateB = latest[b.slug] || '2000-01-01'
    return dateB.localeCompare(dateA)
  })
}
