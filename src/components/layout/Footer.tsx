'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Phone } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { getSiteSettings, defaultSiteSettings } from '@/lib/config'

export function Footer({ initialSettings }: { initialSettings?: Record<string, unknown> | null }) {
  const [s, setS] = useState(() =>
    initialSettings ? { ...defaultSiteSettings, ...initialSettings } as typeof defaultSiteSettings : defaultSiteSettings
  )

  useEffect(() => {
    // Read localStorage (may have newer data than SSR props)
    const latest = getSiteSettings()
    setS(prev => JSON.stringify(prev) !== JSON.stringify(latest) ? latest : prev)
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_site_settings') {
        setS(getSiteSettings())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const footerSections = useMemo(() => ({
    'Sản phẩm': [
      { label: 'Sample Pack', href: '/danh-muc/sample-pack' },
      { label: 'FLP Project', href: '/danh-muc/flp' },
      { label: 'VST Plugin', href: '/danh-muc/vst' },
      { label: 'Preset', href: '/danh-muc/preset' },
      { label: 'Instrument', href: '/danh-muc/instrument' },
      { label: 'Sóng nhạc Lyrics', href: '/danh-muc/song-nhac-lyrics' },
      { label: 'Tất cả sản phẩm', href: '/san-pham' },
    ],
    'Hỗ trợ': [
      { label: 'Giới thiệu', href: '/gioi-thieu' },
      { label: 'Liên hệ', href: '/lien-he' },
      { label: 'Câu hỏi thường gặp', href: '/hoi-dap' },
      { label: 'Blog / Hướng dẫn', href: '/blog' },
      { label: 'Nạp tiền', href: '/nap-tien' },
    ],
    'Chính sách': [
      { label: 'Điều khoản sử dụng', href: '/dieu-khoan' },
      { label: 'Chính sách bảo mật', href: '/chinh-sach-bao-mat' },
    ],
    'Liên kết': [
      ...(s.facebook ? [{ label: 'Facebook', href: s.facebook }] : []),
      ...(s.youtube ? [{ label: 'YouTube', href: s.youtube }] : []),
      ...(s.tiktok ? [{ label: 'TikTok', href: s.tiktok }] : []),
      ...(s.zalo ? [{ label: 'Zalo', href: s.zalo }] : []),
      ...(s.telegram ? [{ label: 'Telegram', href: s.telegram }] : []),
    ],
  }), [s])

  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="container mx-auto px-4 py-10 md:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center mb-3">
              <Image
                src="/logo.svg"
                alt={s.logoText || s.siteName}
                width={160}
                height={38}
                className="h-8 w-auto"
              />
            </Link>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              {s.footerText}
            </p>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <a href={`mailto:${s.contactEmail}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                <Mail className="h-4 w-4 shrink-0" />
                {s.contactEmail}
              </a>
              <a href={`tel:${s.contactPhone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                <Phone className="h-4 w-4 shrink-0" />
                {s.contactPhone}
              </a>
            </div>
          </div>

          {/* Link sections */}
          {Object.entries(footerSections).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-semibold text-foreground mb-3 text-sm">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>{s.copyrightText || `© ${new Date().getFullYear()} ${s.siteName}. All rights reserved.`}</p>
          <div className="flex items-center gap-4">
            <Link href="/dieu-khoan" className="hover:text-primary transition-colors">Điều khoản</Link>
            <Link href="/chinh-sach-bao-mat" className="hover:text-primary transition-colors">Bảo mật</Link>
            <Link href="/lien-he" className="hover:text-primary transition-colors">Liên hệ</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
