import type { Metadata } from 'next'
import Link from 'next/link'
import { Music, Users, Download, Shield, Star, Headphones, ArrowRight, Zap, Heart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { siteConfig } from '@/lib/config'
import { getSiteStats } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Giới thiệu',
  description: 'Giới thiệu về Thư Viện Số - Nền tảng tài nguyên âm nhạc hàng đầu Việt Nam',
}

const features = [
  {
    icon: Download,
    title: 'Tải nhanh & An toàn',
    description: 'Hệ thống download tốc độ cao, file được kiểm tra virus và đảm bảo chất lượng.',
  },
  {
    icon: Shield,
    title: 'Thanh toán bảo mật',
    description: 'Hỗ trợ VNPay, MoMo, chuyển khoản. Giao dịch được mã hóa và bảo vệ.',
  },
  {
    icon: Star,
    title: 'Chất lượng cao',
    description: 'Mọi sản phẩm đều được kiểm tra kỹ lưỡng trước khi đăng tải lên hệ thống.',
  },
  {
    icon: Headphones,
    title: 'Nghe thử trước',
    description: 'Hỗ trợ preview audio trực tiếp trên website để bạn đánh giá trước khi mua.',
  },
  {
    icon: Zap,
    title: 'Cập nhật thường xuyên',
    description: 'Sản phẩm mới được thêm hàng tuần: Sample Pack, FLP, Preset, VST mới nhất.',
  },
  {
    icon: Heart,
    title: 'Hỗ trợ tận tình',
    description: 'Đội ngũ support sẵn sàng giải đáp mọi thắc mắc qua email và mạng xã hội.',
  },
]

function formatStat(n: number): string {
  if (n === 0) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+`
  return `${n}+`
}

export default async function AboutPage() {
  const siteStats = await getSiteStats()

  const stats = [
    { value: formatStat(siteStats?.totalProducts ?? 0), label: 'Sản phẩm' },
    { value: formatStat(siteStats?.totalUsers ?? 0), label: 'Người dùng' },
    { value: formatStat(siteStats?.totalDownloads ?? 0), label: 'Lượt tải' },
    { value: formatStat(siteStats?.freeProducts ?? 0), label: 'Sản phẩm miễn phí' },
  ]
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)]" />
        <div className="container relative mx-auto px-4 py-12 sm:py-16 text-center">
          <Badge variant="secondary" className="mb-3 bg-secondary/10 text-secondary border-secondary/20 text-xs">
            <Music className="h-3 w-3 mr-1" />
            Về chúng tôi
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
            <span className="text-primary">{siteConfig.name}</span>
          </h1>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Nền tảng chia sẻ tài nguyên sản xuất nhạc lớn nhất Việt Nam.
            Cung cấp Sample Pack, FLP Project, VST Plugin & Preset chất lượng cao cho Producer.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="container mx-auto px-4 -mt-6 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-border bg-card">
              <CardContent className="p-4 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-primary font-mono">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Mission */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Sứ mệnh của chúng tôi</h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {siteConfig.name} được tạo ra với mong muốn mang đến cho cộng đồng Producer Việt Nam
            một nơi tập trung các tài nguyên sản xuất âm nhạc chất lượng cao. Chúng tôi hiểu rằng
            việc tìm kiếm Sample Pack, FLP Project hay VST Plugin phù hợp có thể mất rất nhiều
            thời gian. Vì vậy, tất cả sản phẩm trên nền tảng đều được tuyển chọn, kiểm tra kỹ
            lưỡng và phân loại rõ ràng để bạn có thể tập trung vào điều quan trọng nhất — sáng tạo âm nhạc.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-b border-border bg-card/30">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-8">Tại sao chọn chúng tôi?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border bg-card hover:border-primary/30 transition-all">
                <CardContent className="p-5 sm:p-6">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base mb-1">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team / Community */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-3">Cộng đồng Producer Việt</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
            Tham gia cộng đồng hàng nghìn Producer đang sử dụng tài nguyên từ {siteConfig.name}.
            Kết nối, chia sẻ kinh nghiệm và cùng nhau phát triển.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/san-pham">
                Khám phá sản phẩm
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/lien-he">Liên hệ hỗ trợ</Link>
            </Button>
          </div>
        </div>
      </section>

      <Separator />
    </div>
  )
}
