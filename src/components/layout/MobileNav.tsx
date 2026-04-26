'use client'

/**
 * Mobile slide-out navigation — tap targets ≥44px, sticky search,
 * prominent Tools spotlight, grouped sections. Uses shared config where
 * possible so new routes don't silently miss mobile.
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Menu, FileAudio, Guitar, Plug, Sliders, Mic, Monitor, BookOpen, Home,
  Search, Info, HelpCircle, Phone, Wallet, Music, Wand2, Sparkles,
  Package, Gift,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Category items mirror config.navItems (kept in sync — tools handled separately)
const categoryItems = [
  { label: 'Sample Pack', href: '/danh-muc/sample-pack', icon: Music },
  { label: 'FLP Project', href: '/danh-muc/flp', icon: FileAudio },
  { label: 'VST Plugin', href: '/danh-muc/vst', icon: Plug },
  { label: 'Preset', href: '/danh-muc/preset', icon: Sliders },
  { label: 'Instrument', href: '/danh-muc/instrument', icon: Guitar },
  { label: 'Sóng nhạc Lyrics', href: '/danh-muc/song-nhac-lyrics', icon: Mic },
  { label: 'Cài đặt phần mềm', href: '/danh-muc/cai-dat-phan-mem', icon: Monitor },
]

const toolItems = [
  {
    label: 'Xóa Giọng AI',
    desc: 'Tách vocal / instrumental',
    href: '/cong-cu/xoa-giong-ai',
    icon: Wand2,
    gradient: 'from-fuchsia-500/20 to-purple-500/10 border-fuchsia-500/30',
    iconColor: 'text-fuchsia-400',
    badge: 'HOT',
  },
]

const quickItems = [
  { label: 'Tất cả sản phẩm', href: '/san-pham', icon: Package },
  { label: 'Tải miễn phí', href: '/san-pham?free=true', icon: Gift },
  { label: 'Blog', href: '/blog', icon: BookOpen },
]

const extraItems = [
  { label: 'Nạp tiền', href: '/nap-tien', icon: Wallet },
  { label: 'Giới thiệu', href: '/gioi-thieu', icon: Info },
  { label: 'Liên hệ', href: '/lien-he', icon: Phone },
  { label: 'Hỏi đáp (FAQ)', href: '/hoi-dap', icon: HelpCircle },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  )
}

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  const close = () => setOpen(false)

  function handleSearch() {
    const q = searchQuery.trim()
    if (q) {
      router.push(`/tim-kiem?q=${encodeURIComponent(q)}`)
      setSearchQuery('')
      close()
    }
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href.split('?')[0] + '/'))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10 text-muted-foreground hover:text-primary"
          aria-label="Mở menu điều hướng"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[300px] max-w-[85vw] bg-card border-border p-0 flex flex-col"
      >
        {/* Sticky header: logo + search */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
          <SheetHeader className="px-4 pt-4 pb-3">
            <SheetTitle className="flex items-center gap-2 text-primary text-base">
              <Image src="/logo-icon.svg" alt="Thư Viện Số" width={28} height={28} className="h-7 w-7" />
              Thư Viện Số
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm sản phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9 h-10 bg-muted/50 border-border text-sm"
                aria-label="Tìm kiếm sản phẩm"
              />
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-6">
          {/* Home quick link */}
          <nav className="px-2 pt-2">
            <Link
              href="/"
              prefetch
              onClick={close}
              className={cn(
                'flex items-center gap-3 h-11 px-3 text-sm font-medium rounded-lg transition-colors',
                pathname === '/'
                  ? 'text-primary bg-primary/10'
                  : 'text-foreground hover:bg-primary/5 active:bg-primary/10'
              )}
            >
              <Home className="h-4 w-4 shrink-0" />
              Trang chủ
            </Link>
          </nav>

          {/* Tools spotlight — gradient cards */}
          <SectionLabel>
            <Sparkles className="inline h-3 w-3 mr-1 text-fuchsia-400" />
            Công cụ AI
          </SectionLabel>
          <div className="px-3 space-y-2">
            {toolItems.map((t) => {
              const active = isActive(t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  prefetch
                  onClick={close}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl border px-3 py-3 transition-all active:scale-[0.98]',
                    'bg-gradient-to-br',
                    t.gradient,
                    active && 'ring-2 ring-primary/50'
                  )}
                >
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/50',
                    t.iconColor
                  )}>
                    <t.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{t.label}</span>
                      {t.badge && (
                        <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-fuchsia-500 text-white">
                          {t.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{t.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Categories */}
          <SectionLabel>Danh mục</SectionLabel>
          <nav className="px-2 space-y-0.5">
            {categoryItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onClick={close}
                  className={cn(
                    'flex items-center gap-3 h-11 px-3 text-sm font-medium rounded-lg transition-colors',
                    active
                      ? 'text-primary bg-primary/10'
                      : 'text-foreground/85 hover:bg-primary/5 active:bg-primary/10'
                  )}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Quick shortcuts */}
          <SectionLabel>Khám phá</SectionLabel>
          <nav className="px-2 space-y-0.5">
            {quickItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onClick={close}
                  className={cn(
                    'flex items-center gap-3 h-11 px-3 text-sm font-medium rounded-lg transition-colors',
                    active
                      ? 'text-primary bg-primary/10'
                      : 'text-foreground/85 hover:bg-primary/5 active:bg-primary/10'
                  )}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Info / support */}
          <SectionLabel>Thông tin</SectionLabel>
          <nav className="px-2 space-y-0.5">
            {extraItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onClick={close}
                  className={cn(
                    'flex items-center gap-3 h-11 px-3 text-sm font-medium rounded-lg transition-colors',
                    active
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-primary/5 active:bg-primary/10'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
}
