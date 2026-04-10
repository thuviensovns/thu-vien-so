import type { DemoProduct } from '@/lib/demo-data'
import type { Product } from '@/types/payload-types'

/**
 * Map a raw Payload CMS document to a DemoProduct shape.
 * Used by both the storefront (HomeContent) and admin (ProductTable) to
 * normalise DB records into the client-side product type.
 */
export function mapPayloadDoc(doc: Record<string, unknown> | Product): DemoProduct {
  const pricing = (doc.pricing as Record<string, unknown>) || {}
  const preview = (doc.preview as Record<string, unknown>) || {}
  const category = (doc.category as Record<string, unknown>) || {}
  const fileGroup = (doc.file as Record<string, unknown>) || {}
  const thumbnail = doc.thumbnail
  let thumbUrl = '/images/placeholder.jpg'
  // Prefer thumbnailUrl (R2/external) over Payload media thumbnail
  if (doc.thumbnailUrl && typeof doc.thumbnailUrl === 'string') {
    thumbUrl = doc.thumbnailUrl
  } else if (thumbnail && typeof thumbnail === 'object' && 'url' in thumbnail) {
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
    file: {
      r2Key: fileGroup.r2Key ? String(fileGroup.r2Key) : undefined,
      fileName: fileGroup.fileName ? String(fileGroup.fileName) : undefined,
      fileSize: fileGroup.fileSize ? Number(fileGroup.fileSize) : undefined,
      fileFormat: fileGroup.fileFormat ? String(fileGroup.fileFormat) : undefined,
      downloadUrl: fileGroup.downloadUrl ? String(fileGroup.downloadUrl) : undefined,
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
export function mapPayloadDocs(docs: Record<string, unknown>[]): (DemoProduct & { createdAt: string; isDb: true })[] {
  return docs.map((doc) => ({
    ...mapPayloadDoc(doc),
    createdAt: String(doc.createdAt || doc.updatedAt || ''),
    isDb: true as const,
  }))
}
