import { describe, it, expect } from 'vitest'
import { mapPayloadDoc, mapPayloadDocs } from '../product-mapper'

const mockProduct = {
  id: 1,
  name: 'Test Sample Pack',
  slug: 'test-sample-pack',
  type: 'sample-pack',
  pricing: { price: 50000, originalPrice: 100000, isFree: false },
  preview: { bpm: 128, musicalKey: 'Am' },
  category: { slug: 'sample-pack', name: 'Sample Pack' },
  file: {
    r2Key: 'products/test.zip',
    fileName: 'test.zip',
    fileSize: 1024000,
    fileFormat: 'zip',
    downloadUrl: 'https://example.com/test.zip',
  },
  thumbnail: { url: '/images/test.jpg' },
  thumbnailUrl: 'https://r2.example.com/thumb.jpg',
  downloadCount: 42,
  featured: true,
  updatedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('mapPayloadDoc', () => {
  it('maps a complete Payload document correctly', () => {
    const result = mapPayloadDoc(mockProduct as any)
    expect(result.id).toBe('1')
    expect(result.name).toBe('Test Sample Pack')
    expect(result.slug).toBe('test-sample-pack')
    expect(result.type).toBe('sample-pack')
    expect(result.pricing.price).toBe(50000)
    expect(result.pricing.originalPrice).toBe(100000)
    expect(result.downloadCount).toBe(42)
    expect(result.featured).toBe(true)
  })

  it('prefers thumbnailUrl (R2) over Payload media thumbnail', () => {
    const result = mapPayloadDoc(mockProduct as any)
    expect(result.thumbnail.url).toBe('https://r2.example.com/thumb.jpg')
  })

  it('falls back to Payload media url when no thumbnailUrl', () => {
    const noR2 = { ...mockProduct, thumbnailUrl: undefined }
    const result = mapPayloadDoc(noR2 as any)
    expect(result.thumbnail.url).toBe('/images/test.jpg')
  })

  it('falls back to placeholder when no image at all', () => {
    const noImage = { ...mockProduct, thumbnailUrl: undefined, thumbnail: undefined }
    const result = mapPayloadDoc(noImage as any)
    expect(result.thumbnail.url).toBe('/images/placeholder.jpg')
  })

  it('handles missing optional fields gracefully', () => {
    const minimal = {
      id: 2,
      name: 'Minimal',
      slug: 'minimal',
      type: 'flp',
      pricing: { price: 0 },
      updatedAt: '2026-01-01',
    }
    const result = mapPayloadDoc(minimal as any)
    expect(result.name).toBe('Minimal')
    expect(result.preview?.bpm).toBeNull()
    expect(result.category).toBeUndefined()
    expect(result.downloadCount).toBe(0)
  })

  it('correctly identifies free products (price=0)', () => {
    const free = { ...mockProduct, pricing: { price: 0, isFree: false } }
    const result = mapPayloadDoc(free as any)
    expect(result.pricing.isFree).toBe(true)
  })

  it('correctly identifies free products (isFree=true)', () => {
    const free = { ...mockProduct, pricing: { price: 50000, isFree: true } }
    const result = mapPayloadDoc(free as any)
    expect(result.pricing.isFree).toBe(true)
  })

  it('maps file fields correctly', () => {
    const result = mapPayloadDoc(mockProduct as any)
    expect(result.file?.r2Key).toBe('products/test.zip')
    expect(result.file?.fileName).toBe('test.zip')
    expect(result.file?.fileSize).toBe(1024000)
    expect(result.file?.downloadUrl).toBe('https://example.com/test.zip')
  })
})

describe('mapPayloadDocs', () => {
  it('adds createdAt and isCustom fields', () => {
    const results = mapPayloadDocs([mockProduct as any])
    expect(results[0].createdAt).toBe('2026-01-01T00:00:00Z')
    expect(results[0].isCustom).toBe(true)
  })

  it('handles empty array', () => {
    expect(mapPayloadDocs([])).toEqual([])
  })
})
