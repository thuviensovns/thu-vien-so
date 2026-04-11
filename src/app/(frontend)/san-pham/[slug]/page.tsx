import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

import { getProductBySlug } from '@/lib/payload'
import { typeLabels } from '@/lib/config'
import { ProductDetailClient } from '@/components/product/ProductDetailClient'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    return {
      title: 'Chi tiết sản phẩm',
      description: 'Download tài nguyên sản xuất nhạc',
    }
  }

  return {
    title: product.name,
    description: `Download ${product.name} - ${typeLabels[product.type] || product.type} cho Producer`,
    openGraph: {
      type: 'website',
      images: (() => {
        const r2Url = typeof (product as Record<string, unknown>).thumbnailUrl === 'string' ? (product as Record<string, unknown>).thumbnailUrl as string : ''
        const mediaUrl = typeof (product as Record<string, unknown>).thumbnail === 'object' ? (product.thumbnail as { url?: string })?.url : ''
        const img = r2Url || mediaUrl
        return img ? [img] : []
      })(),
    },
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  return <ProductDetailClient slug={slug} serverProduct={product || null} />
}
