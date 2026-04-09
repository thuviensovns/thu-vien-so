'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Music, FileAudio, Guitar, Plug, Sliders, Mic, BookOpen, Home, Search, Info, HelpCircle, Phone, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const mobileNavItems = [
  { label: 'Trang chủ', href: '/', icon: Home },
  { label: 'Sample Pack', href: '/danh-muc/sample-pack', icon: Music },
  { label: 'FLP Project', href: '/danh-muc/flp', icon: FileAudio },
  { label: 'VST Plugin', href: '/danh-muc/vst', icon: Plug },
  { label: 'Preset', href: '/danh-muc/preset', icon: Sliders },
  { label: 'Instrument', href: '/danh-muc/instrument', icon: Guitar },
  { label: 'Sóng nhạc Lyrics', href: '/danh-muc/song-nhac-lyrics', icon: Mic },
  { label: 'Blog', href: '/blog', icon: BookOpen },
]

const extraNavItems = [
  { label: 'Nạp tiền', href: '/nap-tien', icon: Wallet },
  { label: 'Giới thiệu', href: '/gioi-thieu', icon: Info },
  { label: 'Liên hệ', href: '/lien-he', icon: Phone },
  { label: 'Hỏi đáp (FAQ)', href: '/hoi-dap', icon: HelpCircle },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  function handleSearch() {
    const q = searchQuery.trim()
    if (q) {
      router.push(`/tim-kiem?q=${encodeURIComponent(q)}`)
      setSearchQuery('')
      setOpen(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground hover:text-primary" aria-label="Mở menu điều hướng">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] max-w-[80vw] bg-card border-border p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2 text-primary text-base">
            <Music className="h-5 w-5" />
            Thư Viện Số
          </SheetTitle>
        </SheetHeader>

        {/* Mobile search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 bg-muted/50 border-border h-9 text-sm"
              aria-label="Tìm kiếm sản phẩm"
            />
          </div>
        </div>

        <Separator />

        <nav className="flex flex-col gap-0.5 p-2">
          {mobileNavItems.map((item, index) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none animate-fade-in-up',
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-primary hover:bg-primary/5 active:scale-[0.98]'
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <Separator className="mx-4" />

        <nav className="flex flex-col gap-0.5 p-2">
          {extraNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-primary hover:bg-primary/5 active:scale-[0.98]'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <Separator className="mx-4" />

        <div className="p-4 space-y-1">
          <Link
            href="/san-pham"
            onClick={() => setOpen(false)}
            className="block text-sm text-muted-foreground hover:text-primary transition-colors py-1.5"
          >
            Tất cả sản phẩm
          </Link>
          <Link
            href="/san-pham?free=true"
            onClick={() => setOpen(false)}
            className="block text-sm text-accent hover:text-accent/80 transition-colors py-1.5"
          >
            Tải miễn phí
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
