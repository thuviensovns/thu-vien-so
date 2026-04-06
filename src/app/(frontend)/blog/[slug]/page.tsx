import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, User, Clock, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { getBlogPostBySlug } from '@/lib/payload'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const post = await getBlogPostBySlug(slug)
    if (post) {
      const p = post as Record<string, unknown>
      const title = p.title as string || slug.replace(/-/g, ' ')
      const description = p.excerpt as string || ''
      return {
        title,
        description,
        openGraph: { title, description, type: 'article' },
      }
    }
  } catch {
    // DB not connected, use slug as title
  }
  return {
    title: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }
}

const categoryLabels: Record<string, string> = {
  tutorial: 'Hướng dẫn',
  tips: 'Mẹo hay',
  news: 'Tin tức',
  review: 'Đánh giá',
}

// Valid demo blog slugs — must match demoPosts in blog/page.tsx
const validDemoSlugs = [
  'tong-hop-phim-tat-fl-studio',
  'huong-dan-cai-dat-fl-studio-v25-1-6',
  '10-meo-mix-nhac-vinahouse',
]

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params

  let post: any = null
  try {
    post = await getBlogPostBySlug(slug)
  } catch {
    // DB not connected — show demo content
  }

  // Show 404 if slug doesn't match any demo post and DB returned nothing
  if (!post && !validDemoSlugs.includes(slug)) {
    notFound()
  }

  const title = post?.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const category = post?.blogCategory || 'tutorial'
  const author = typeof post?.author === 'object' ? post?.author?.displayName : 'Admin'
  const publishedAt = post?.publishedAt ? new Date(post.publishedAt).toLocaleDateString('vi-VN') : '31/03/2026'
  const excerpt = post?.excerpt || 'Bài viết hướng dẫn chi tiết cho Producer Việt Nam.'
  const featuredImage = typeof post?.featuredImage === 'object' ? post?.featuredImage?.url : null
  const defaultTags: Record<string, string[]> = {
    'tong-hop-phim-tat-fl-studio': ['FL Studio', 'Phím tắt', 'Producer', 'Tutorial'],
    'huong-dan-cai-dat-fl-studio-v25-1-6': ['FL Studio', 'Cài đặt', 'Hướng dẫn'],
    '10-meo-mix-nhac-vinahouse': ['Vinahouse', 'Mixing', 'Producer'],
  }
  const tags = post?.tags?.map((t: any) => t.tag).filter(Boolean) || defaultTags[slug] || ['Producer', 'Tutorial', 'Sản xuất nhạc']

  const demoExcerpts: Record<string, string> = {
    'tong-hop-phim-tat-fl-studio': 'Khám phá bảng phím tắt FL Studio đầy đủ: Playlist, Piano Roll, Mixer, Channel Rack… Giúp producer tăng tốc làm nhạc nhanh chóng và hiệu quả.',
  }
  const finalExcerpt = post?.excerpt || demoExcerpts[slug] || excerpt

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="container relative mx-auto px-4 py-8 sm:py-10">
          <nav className="mb-4">
            <Link href="/blog" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 w-fit">
              <ArrowLeft className="h-3 w-3" />
              Quay lại Blog
            </Link>
          </nav>

          <Badge variant="secondary" className="mb-3 bg-secondary/10 text-secondary border-secondary/20 text-xs">
            {categoryLabels[category] || category}
          </Badge>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold max-w-3xl">{title}</h1>

          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">{finalExcerpt}</p>

          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {author}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {publishedAt}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              5 phút đọc
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main content */}
          <article className="lg:col-span-3">
            {/* Featured image */}
            {featuredImage && (
              <div className="relative aspect-video rounded-xl overflow-hidden mb-8 border border-border">
                <Image src={featuredImage} alt={title} fill className="object-cover" />
              </div>
            )}

            {!featuredImage && (
              <div className="aspect-video rounded-xl bg-muted/30 border border-border mb-8 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Ảnh bài viết</p>
              </div>
            )}

            {/* Rich text content */}
            {post?.content ? (
              <div className="prose prose-sm prose-invert max-w-none">
                {/* Payload Lexical rich text sẽ render ở đây */}
                <p className="text-muted-foreground">
                  Nội dung bài viết từ Payload CMS.
                </p>
              </div>
            ) : slug === 'tong-hop-phim-tat-fl-studio' ? (
              <FLStudioShortcutsContent />
            ) : (
              <DefaultDemoContent title={title} />
            )}

            {/* Tags */}
            <Separator className="my-6" />
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {tags.map((tag: string) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-[4.5rem] space-y-4">
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <h3 className="font-bold text-sm mb-3">Danh mục bài viết</h3>
                  <div className="space-y-1.5">
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <Link
                        key={key}
                        href={`/blog?category=${key}`}
                        className="block text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <h3 className="font-bold text-sm mb-2">Sản phẩm liên quan</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Khám phá thêm tài nguyên cho Producer
                  </p>
                  <Link href="/san-pham" className="text-sm text-primary hover:underline font-medium">
                    Xem sản phẩm →
                  </Link>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ─── Shortcut Table Component ─── */
function ShortcutTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border">
            <th className="text-left px-4 py-2.5 font-semibold text-foreground w-[180px]">Phím tắt</th>
            <th className="text-left px-4 py-2.5 font-semibold text-foreground">Chức năng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, desc], i) => (
            <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2">
                <kbd className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold">
                  {key}
                </kbd>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── FL Studio Shortcuts Full Content ─── */
function FLStudioShortcutsContent() {
  const sections: { emoji: string; title: string; rows: [string, string][] }[] = [
    {
      emoji: '🎼', title: '1. Quản lý File & Dự án',
      rows: [
        ['Ctrl + O', 'Mở file'],
        ['Ctrl + S', 'Lưu file hiện tại'],
        ['Ctrl + N', 'Lưu version mới'],
        ['Ctrl + Shift + S', 'Save As…'],
        ['Ctrl + R', 'Xuất file WAV'],
        ['Ctrl + Shift + R', 'Xuất file MP3'],
        ['Ctrl + Shift + M', 'Xuất MIDI'],
        ['Alt + 0…9', 'Mở nhanh file gần đây'],
        ['Ctrl + Shift + H', 'Sắp xếp lại cửa sổ'],
      ],
    },
    {
      emoji: '🎹', title: '2. Pattern',
      rows: [
        ['1…9 (Numlock)', 'Chọn pattern 1 → 9'],
        ['+', 'Next pattern'],
        ['–', 'Previous pattern'],
        ['F2', 'Đặt tên pattern, nhấn liên tục để đổi màu'],
        ['F4', 'Tạo pattern mới & đặt tên'],
        ['Ctrl + F4', 'Tạo pattern trống'],
      ],
    },
    {
      emoji: '🎛️', title: '3. Channel Rack',
      rows: [
        ['Ctrl + 1…9, 0', 'Solo / UnSolo 10 channel đầu'],
        ['Mũi tên ↑ / ↓', 'Chọn channel trên / dưới'],
        ['Page Up / Page Down', 'Chọn group channel'],
        ['Alt + Del', 'Xoá channel'],
        ['Alt + ↑ / ↓', 'Di chuyển channel lên / xuống'],
        ['Alt + C', 'Clone channel'],
        ['Alt + G', 'Đặt nhóm channel'],
        ['Alt + Z / U', 'Zip / Unzip channel'],
        ['Ctrl + C / V / X', 'Copy / Paste / Cut step'],
        ['Ctrl + L', 'Link channel sang mixer trống'],
      ],
    },
    {
      emoji: '🎚️', title: '4. Record / Playback',
      rows: [
        ['Space', 'Play / Stop'],
        ['Shift + L', 'Chuyển Pattern / Song'],
        ['Shift + R', 'Bật / tắt Record'],
        ['Ctrl + H', 'Panic – Stop sound'],
        ['Ctrl + M', 'Metronome'],
        ['0 / * / / (NumPad)', 'Điều khiển tua nhanh, lùi, tiến'],
      ],
    },
    {
      emoji: '📑', title: '5. Window Navigation',
      rows: [
        ['F5', 'Mở Playlist'],
        ['F6', 'Mở Channel Rack'],
        ['F7', 'Mở Piano Roll'],
        ['F9', 'Mở Mixer'],
        ['F12', 'Đóng tất cả cửa sổ'],
        ['Tab', 'Chuyển đổi cửa sổ'],
        ['F8', 'Plugin Picker'],
      ],
    },
    {
      emoji: '🎚️', title: '6. Mixer',
      rows: [
        ['Alt + ← / →', 'Di chuyển mixer'],
        ['Alt + W', 'Xem dạng sóng'],
        ['Shift + lăn chuột', 'Di chuyển ngang mixer'],
        ['Ctrl + Shift + click', 'Chọn nhiều track'],
        ['F2', 'Đặt tên mixer track'],
        ['S', 'Solo track đang chọn'],
      ],
    },
    {
      emoji: '🎼', title: '7. Playlist',
      rows: [
        ['B / P / C / E / D', 'Paint, Draw, Slice, Select, Delete tool'],
        ['Alt + M', 'Mute vùng chọn'],
        ['Alt + T', 'Thêm Time Marker'],
        ['Ctrl + A / C / V / X / D', 'Select All / Copy / Paste / Cut / Deselect'],
        ['Ctrl + B', 'Nhân đôi vùng chọn'],
        ['Shift + mũi tên', 'Di chuyển clip / vùng chọn'],
        ['Del', 'Xoá clip'],
        ['F3', 'Công cụ Playlist'],
      ],
    },
    {
      emoji: '🎹', title: '8. Piano Roll',
      rows: [
        ['Alt + Q', 'Quantize'],
        ['Alt + R', 'Randomize'],
        ['Alt + S', 'Strum'],
        ['Alt + U', 'Chop'],
        ['Alt + V', 'Bật Ghost Channel'],
        ['Ctrl + B', 'Nhân đôi note'],
        ['Ctrl + ↑ / ↓', 'Tăng / giảm cao độ'],
        ['Đúp chuột trái', 'Note properties'],
        ['Shift + chuột', 'Slice hoặc Clone note'],
        ['PgUp / PgDn', 'Zoom in / out'],
      ],
    },
  ]

  return (
    <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
      <p>
        Trong quá trình làm nhạc bằng <strong className="text-foreground">FL Studio</strong>, việc nắm vững
        phím tắt (shortcuts) sẽ giúp bạn tiết kiệm thời gian, thao tác nhanh gọn và giữ được flow sáng tạo.
        Dưới đây là bảng tổng hợp phím tắt FL Studio quan trọng, chia theo từng khu vực làm việc.
      </p>

      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="text-lg font-bold text-foreground mt-8 mb-3">
            {section.emoji} {section.title}
          </h2>
          <ShortcutTable rows={section.rows} />
        </div>
      ))}

      <div className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-foreground font-medium">
          💡 Mẹo: Việc nhớ hết các phím tắt trong FL Studio không cần thiết ngay lập tức, nhưng bạn nên
          tập trung vào những phím mình dùng nhiều (ví dụ: <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">Ctrl+S</kbd>,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">Space</kbd>,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">F5</kbd>,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">F6</kbd>,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">F7</kbd>,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">F9</kbd>,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">Alt+Q</kbd>).
          Khi quen tay, tốc độ làm nhạc của bạn sẽ tăng gấp đôi!
        </p>
      </div>
    </div>
  )
}

/* ─── Default Demo Content ─── */
function DefaultDemoContent({ title }: { title: string }) {
  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      <p>
        Đây là nội dung demo cho bài viết <strong className="text-foreground">&quot;{title}&quot;</strong>.
        Khi kết nối database, nội dung thực sẽ được hiển thị từ Payload CMS Lexical editor.
      </p>
      <p>
        FL Studio là một trong những phần mềm sản xuất âm nhạc phổ biến nhất thế giới,
        được sử dụng bởi hàng triệu Producer từ nghiệp dư đến chuyên nghiệp. Với giao
        diện trực quan và bộ công cụ mạnh mẽ, FL Studio là lựa chọn hàng đầu cho dòng
        nhạc EDM, Hip-hop, Pop và nhiều thể loại khác.
      </p>
      <h2 className="text-lg font-bold text-foreground mt-6 mb-2">Các tính năng nổi bật</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Piano Roll cao cấp với nhiều công cụ chỉnh sửa MIDI</li>
        <li>Mixer đa năng với hỗ trợ VST/AU plugin</li>
        <li>Playlist linh hoạt cho arrangement</li>
        <li>Automation mượt mà cho mọi parameter</li>
        <li>Hỗ trợ nhiều định dạng âm thanh và MIDI</li>
      </ul>
      <h2 className="text-lg font-bold text-foreground mt-6 mb-2">Kết luận</h2>
      <p>
        Hy vọng bài viết này giúp bạn có thêm kiến thức hữu ích cho quá trình sản xuất
        âm nhạc. Đừng quên theo dõi Thư Viện Số để cập nhật thêm nhiều bài viết mới.
      </p>
    </div>
  )
}
