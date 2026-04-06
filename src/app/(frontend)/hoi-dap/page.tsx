'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HelpCircle, ChevronDown, Search, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const faqCategories = [
  { id: 'all', label: 'Tất cả' },
  { id: 'account', label: 'Tài khoản' },
  { id: 'payment', label: 'Thanh toán' },
  { id: 'download', label: 'Tải xuống' },
  { id: 'product', label: 'Sản phẩm' },
  { id: 'other', label: 'Khác' },
]

const faqs = [
  {
    category: 'account',
    question: 'Làm sao để tạo tài khoản?',
    answer: 'Truy cập trang Đăng ký, nhập tên hiển thị, email và mật khẩu (tối thiểu 8 ký tự). Sau khi đăng ký thành công, bạn có thể đăng nhập ngay lập tức.',
  },
  {
    category: 'account',
    question: 'Tôi quên mật khẩu, phải làm sao?',
    answer: 'Vui lòng liên hệ support qua email hoặc fanpage Facebook để được hỗ trợ khôi phục tài khoản. Chúng tôi sẽ xác minh danh tính và gửi link đặt lại mật khẩu.',
  },
  {
    category: 'payment',
    question: 'Hỗ trợ những phương thức thanh toán nào?',
    answer: 'Hiện tại chúng tôi hỗ trợ thanh toán qua VNPay (thẻ ATM, Visa/Master), ví MoMo và chuyển khoản ngân hàng trực tiếp. Mọi giao dịch đều được mã hóa và bảo mật.',
  },
  {
    category: 'payment',
    question: 'Sau khi thanh toán bao lâu thì nhận được sản phẩm?',
    answer: 'Với VNPay và MoMo, sản phẩm sẽ sẵn sàng để tải ngay sau khi thanh toán thành công. Với chuyển khoản ngân hàng, thời gian xử lý từ 15 phút đến 2 giờ trong giờ làm việc.',
  },
  {
    category: 'payment',
    question: 'Tôi có thể yêu cầu hoàn tiền không?',
    answer: 'Do đặc thù sản phẩm số (digital product), chúng tôi không hỗ trợ hoàn tiền sau khi đã tải xuống. Tuy nhiên, nếu sản phẩm bị lỗi hoặc không đúng mô tả, vui lòng liên hệ để được hỗ trợ.',
  },
  {
    category: 'download',
    question: 'Tải sản phẩm như thế nào?',
    answer: 'Sau khi mua hàng thành công, vào mục Tài khoản > Downloads để xem danh sách sản phẩm đã mua. Nhấn nút Tải xuống để download file. Mỗi sản phẩm có giới hạn 5 lần tải trong vòng 72 giờ.',
  },
  {
    category: 'download',
    question: 'Sản phẩm miễn phí có cần đăng nhập không?',
    answer: 'Không, bạn có thể tải sản phẩm miễn phí mà không cần đăng nhập. Tuy nhiên, đăng nhập sẽ giúp bạn quản lý lịch sử tải và nhận thông báo sản phẩm mới.',
  },
  {
    category: 'download',
    question: 'Link tải bị hết hạn, tôi phải làm sao?',
    answer: 'Link tải có hiệu lực trong 72 giờ kể từ khi mua. Nếu đã hết hạn, vui lòng liên hệ support để được cấp lại quyền tải xuống.',
  },
  {
    category: 'product',
    question: 'Sản phẩm tương thích với phần mềm nào?',
    answer: 'Mỗi sản phẩm sẽ ghi rõ thông tin tương thích trong trang chi tiết. Đa số Sample Pack tương thích với tất cả DAW, trong khi FLP Project dành riêng cho FL Studio.',
  },
  {
    category: 'product',
    question: 'Tôi có thể sử dụng sản phẩm cho mục đích thương mại không?',
    answer: 'Có, bạn có thể sử dụng Sample Pack và Preset trong các bản nhạc phát hành thương mại. Tuy nhiên, bạn không được phân phối lại file gốc dưới bất kỳ hình thức nào.',
  },
  {
    category: 'other',
    question: 'Làm sao để liên hệ hỗ trợ?',
    answer: 'Bạn có thể liên hệ qua trang Liên hệ, gửi email trực tiếp hoặc nhắn tin qua fanpage Facebook. Thời gian phản hồi thường trong vòng 24 giờ.',
  },
  {
    category: 'other',
    question: 'Tôi muốn đóng góp sản phẩm lên nền tảng, có được không?',
    answer: 'Chúng tôi luôn chào đón các Producer muốn chia sẻ sản phẩm. Vui lòng liên hệ qua email với thông tin về sản phẩm bạn muốn đăng tải và chúng tôi sẽ review.',
  },
]

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const filtered = faqs.filter((faq) => {
    const matchCategory = activeCategory === 'all' || faq.category === activeCategory
    const matchSearch = !searchQuery || faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--glow),transparent_70%)]" />
        <div className="container relative mx-auto px-4 py-10 sm:py-14 text-center">
          <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary border-primary/20 text-xs">
            <HelpCircle className="h-3 w-3 mr-1" />
            FAQ
          </Badge>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Câu hỏi thường gặp</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            Tìm câu trả lời nhanh cho các thắc mắc phổ biến
          </p>

          {/* Search */}
          <div className="mt-6 max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm câu hỏi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:py-12">
        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {faqCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all border ${
                activeCategory === cat.id
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'text-muted-foreground border-border hover:border-primary/30'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* FAQ list */}
        <div className="max-w-3xl mx-auto space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Không tìm thấy kết quả phù hợp</p>
            </div>
          ) : (
            filtered.map((faq, index) => (
              <Card
                key={index}
                className={`border-border bg-card cursor-pointer transition-all ${
                  openIndex === index ? 'border-primary/30' : 'hover:border-primary/20'
                }`}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4">
                    <h3 className="font-medium text-sm sm:text-base pr-4">{faq.question}</h3>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${openIndex === index ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-border/50 pt-3">
                      {faq.answer}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <p className="text-sm text-muted-foreground mb-3">Không tìm thấy câu trả lời?</p>
          <Button asChild variant="outline">
            <Link href="/lien-he">
              <MessageSquare className="mr-2 h-4 w-4" />
              Liên hệ hỗ trợ
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
