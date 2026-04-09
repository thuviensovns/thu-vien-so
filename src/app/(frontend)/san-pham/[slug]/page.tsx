import type { Metadata } from 'next'

export const revalidate = 60

import { getProductBySlug } from '@/lib/payload'
import { getDemoProductBySlug } from '@/lib/demo-data'
import { typeLabels } from '@/lib/config'
import { ProductDetailClient } from '@/components/product/ProductDetailClient'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  const demo = !product ? getDemoProductBySlug(slug) : null
  const p = product || demo

  // If not found on server, use generic metadata (client may find it in localStorage)
  if (!p) {
    return {
      title: 'Chi tiết sản phẩm',
      description: 'Download tài nguyên sản xuất nhạc',
    }
  }

  return {
    title: p.name,
    description: `Download ${p.name} - ${typeLabels[p.type] || p.type} cho Producer`,
    openGraph: {
      type: 'website',
      images: (() => {
        const r2Url = typeof (p as any).thumbnailUrl === 'string' ? (p as any).thumbnailUrl : ''
        const mediaUrl = typeof (p as Record<string, unknown>).thumbnail === 'object' ? (p.thumbnail as { url?: string })?.url : ''
        const img = r2Url || mediaUrl
        return img ? [img] : []
      })(),
    },
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  // Don't call notFound() — admin-created products only exist in client localStorage.
  // ProductDetailClient will handle the not-found state on the client.
  return <ProductDetailClient slug={slug} serverProduct={product || null} />
}
