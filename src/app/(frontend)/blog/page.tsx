export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getBlogPosts } from '@/lib/payload'

export const metadata: Metadata = {
  title: 'Blog & Hướng dẫn',
  description: 'Hướng dẫn sản xuất nhạc, mẹo hay, tin tức và đánh giá plugin cho Producer',
}

const blogCategoryLabels: Record<string, string> = {
  tutorial: 'Hướng dẫn',
  tips: 'Mẹo hay',
  news: 'Tin tức',
  review: 'Đánh giá',
}

// Fallback demo data — shown only when DB has no posts
const demoPosts = [
  {
    title: 'Tổng Hợp Phím Tắt FL Studio Quan Trọng Cho Producer',
    slug: 'tong-hop-phim-tat-fl-studio',
    excerpt: 'Danh sách đầy đủ các phím tắt quan trọng nhất trong FL Studio giúp tăng tốc workflow.',
    blogCategory: 'tutorial',
    publishedAt: '2026-03-20',
    featuredImage: null as string | null,
  },
  {
    title: 'Hướng Dẫn Cài Đặt FL Studio v25.1.6 All Plugins Edition',
    slug: 'huong-dan-cai-dat-fl-studio-v25-1-6',
    excerpt: 'Hướng dẫn chi tiết cách tải và cài đặt FL Studio phiên bản mới nhất.',
    blogCategory: 'tutorial',
    publishedAt: '2026-03-15',
    featuredImage: null as string | null,
  },
  {
    title: '10 Mẹo Mix Nhạc Vinahouse Chuyên Nghiệp',
    slug: '10-meo-mix-nhac-vinahouse',
    excerpt: 'Những kỹ thuật mixing quan trọng để có bản mix Vinahouse đạt chuẩn phòng thu.',
    blogCategory: 'tips',
    publishedAt: '2026-03-10',
    featuredImage: null as string | null,
  },
]

interface BlogPageProps {
  searchParams: Promise<{ category?: string }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams

  // Fetch real posts from Payload CMS
  const result = await getBlogPosts({
    category: params.category,
    limit: 20,
  })

  // Use real posts if available, otherwise fall back to demo
  const hasRealPosts = result.docs.length > 0
  const posts = hasRealPosts
    ? result.docs.map((doc: any) => ({
        title: doc.title,
        slug: doc.slug,
        excerpt: doc.excerpt || '',
        blogCategory: doc.blogCategory || 'tutorial',
        publishedAt: doc.publishedAt || doc.createdAt,
        featuredImage: typeof doc.featuredImage === 'object' ? doc.featuredImage?.url : null,
      }))
    : params.category
      ? demoPosts.filter((p) => p.blogCategory === params.category)
      : demoPosts

  const activeCategory = params.category ? blogCategoryLabels[params.category] : null

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
          {activeCategory ? `Blog — ${activeCategory}` : 'Blog & Hướng dẫn'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 sm:mt-2">
          Kiến thức, mẹo hay và hướng dẫn sản xuất nhạc cho Producer Việt Nam
        </p>
        {activeCategory && (
          <Link href="/blog" className="text-xs text-primary hover:underline mt-1 inline-block">
            ← Xem tất cả bài viết
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`}>
            <Card className="group border-border bg-card overflow-hidden hover:border-primary/30 transition-all h-full">
              <div className="relative aspect-video overflow-hidden bg-muted/20">
                {post.featuredImage ? (
                  <Image
                    src={post.featuredImage}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    Ảnh bài viết
                  </div>
                )}
              </div>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="bg-secondary/10 text-secondary text-[10px] sm:text-xs">
                    {blogCategoryLabels[post.blogCategory] || post.blogCategory}
                  </Badge>
                  <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(post.publishedAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <h2 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                  {post.title}
                </h2>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{post.excerpt}</p>
                <span className="inline-flex items-center gap-1 text-xs text-primary mt-3">
                  Đọc thêm <ArrowRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Chưa có bài viết nào trong danh mục này.</p>
          <Link href="/blog" className="text-primary hover:underline text-sm mt-2 inline-block">
            ← Xem tất cả bài viết
          </Link>
        </div>
      )}
    </div>
  )
}
