'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, Phone, MapPin, Clock, Send, MessageSquare, ExternalLink, Video } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getSiteSettings, defaultSiteSettings } from '@/lib/config'
import { ContactForm } from './ContactForm'

export function ContactContent() {
  const [s, setS] = useState(defaultSiteSettings)

  const refresh = useCallback(() => setS(getSiteSettings()), [])

  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_site_settings') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const contactInfo = [
    {
      icon: Mail,
      label: 'Email',
      value: s.contactEmail,
      href: `mailto:${s.contactEmail}`,
      description: 'Phản hồi trong vòng 24 giờ',
    },
    {
      icon: Phone,
      label: 'Điện thoại',
      value: s.contactPhone,
      href: `tel:${s.contactPhone.replace(/\s/g, '')}`,
      description: 'Thứ 2 - Thứ 7, 9:00 - 18:00',
    },
    {
      icon: MapPin,
      label: 'Địa chỉ',
      value: s.contactAddress || 'Việt Nam',
      href: '#',
      description: 'Hỗ trợ online toàn quốc',
    },
    {
      icon: Clock,
      label: 'Giờ làm việc',
      value: '9:00 - 18:00',
      href: '#',
      description: 'Thứ 2 đến Thứ 7',
    },
  ]

  const socialLinks = [
    ...(s.facebook ? [{ icon: ExternalLink, label: 'Facebook', href: s.facebook, color: 'text-blue-500' }] : []),
    ...(s.youtube ? [{ icon: Video, label: 'YouTube', href: s.youtube, color: 'text-destructive' }] : []),
    ...(s.tiktok ? [{ icon: MessageSquare, label: 'TikTok', href: s.tiktok, color: 'text-foreground' }] : []),
    ...(s.zalo ? [{ icon: MessageSquare, label: 'Zalo', href: s.zalo, color: 'text-blue-400' }] : []),
    ...(s.telegram ? [{ icon: Send, label: 'Telegram', href: s.telegram, color: 'text-sky-500' }] : []),
  ]

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--glow),transparent_70%)]" />
        <div className="container relative mx-auto px-4 py-10 sm:py-14 text-center">
          <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary border-primary/20 text-xs">
            <Send className="h-3 w-3 mr-1" />
            Liên hệ với chúng tôi
          </Badge>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Liên hệ & Hỗ trợ</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            Bạn cần hỗ trợ kỹ thuật, tư vấn sản phẩm hay có câu hỏi?
            Liên hệ ngay với đội ngũ {s.siteName}.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:py-12">
        {/* Contact info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-10">
          {contactInfo.map((info) => (
            <a key={info.label} href={info.href} className="block group">
              <Card className="border-border bg-card hover:border-primary/30 hover:shadow-glow-sm transition-all h-full">
                <CardContent className="p-4 sm:p-5 text-center">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                    <info.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{info.label}</h3>
                  <p className="text-sm text-primary font-medium mt-1">{info.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{info.description}</p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Contact form */}
          <div className="lg:col-span-3">
            <Card className="border-border bg-card">
              <CardContent className="p-5 sm:p-8">
                <h2 className="text-lg sm:text-xl font-bold mb-1">Gửi tin nhắn</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Điền thông tin bên dưới, chúng tôi sẽ phản hồi sớm nhất có thể.
                </p>
                <ContactForm />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-4">
            {/* Social links */}
            {socialLinks.length > 0 && (
              <Card className="border-border bg-card">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="font-bold text-sm mb-4">Kết nối với chúng tôi</h3>
                  <div className="space-y-2">
                    {socialLinks.map((social) => (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all"
                      >
                        <social.icon className={`h-5 w-5 ${social.color}`} />
                        <div>
                          <span className="text-sm font-medium">{social.label}</span>
                          <p className="text-[11px] text-muted-foreground">Theo dõi để nhận updates</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* FAQ teaser */}
            <Card className="border-border bg-card">
              <CardContent className="p-5 sm:p-6">
                <h3 className="font-bold text-sm mb-2">Câu hỏi thường gặp</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Tìm câu trả lời nhanh cho các vấn đề phổ biến.
                </p>
                <a href="/hoi-dap" className="text-sm text-primary hover:underline font-medium">
                  Xem FAQ →
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
