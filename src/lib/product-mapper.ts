import type { DemoProduct } from '@/lib/demo-data'

/**
 * Map a raw Payload CMS document to a DemoProduct shape.
 * Used by both the storefront (HomeContent) and admin (ProductTable) to
 * normalise DB records into the client-side product type.
 */
export function mapPayloadDoc(doc: Record<string, unknown>): DemoProduct {
  const pricing = (doc.pricing as Record<string, unknown>) || {}
  const preview = (doc.preview as Record<string, unknown>) || {}
  const category = (doc.category as Record<string, unknown>) || {}
  const thumbnail = doc.thumbnail
  let thumbUrl = '/images/placeholder.jpg'
  if (thumbnail && typeof thumbnail === 'object' && 'url' in thumbnail) {
    const url = (thumbnail as Record<string, string>).url
    if (url && !url.endsWith('/placeholder.jpg')) thumbUrl = url
  }
  return {
    id: String(doc.id),
    name: String(doc.name || ''),
    slug: String(doc.slug || ''),
    type: String(doc.type || ''),
    thumbnail: { url: thumbUrl },
    pricing: {
      price: Number(pricing.price || 0),
      originalPrice: pricing.originalPrice ? Number(pricing.originalPrice) : null,
      isFree: Boolean(pricing.isFree) || Number(pricing.price || 0) === 0,
    },
    preview: {
      bpm: preview.bpm ? Number(preview.bpm) : null,
      musicalKey: preview.musicalKey ? String(preview.musicalKey) : null,
    },
    downloadCount: Number(doc.downloadCount || 0),
    featured: Boolean(doc.featured),
    category: category.slug
      ? { slug: String(category.slug), name: String(category.name || '') }
      : undefined,
    updatedAt: String(doc.updatedAt || doc.createdAt || ''),
  }
}

/** Map an array of Payload docs, with extra fields for admin product table */
export function mapPayloadDocs(docs: Record<string, unknown>[]): (DemoProduct & { createdAt: string; isCustom: true })[] {
  return docs.map((doc) => ({
    ...mapPayloadDoc(doc),
    createdAt: String(doc.createdAt || doc.updatedAt || ''),
    isCustom: true as const,
  }))
}
