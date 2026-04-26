'use client'

/**
 * Mobile-only sticky bottom navigation — thumb-reach shortcuts to the
 * most-used surfaces. Hidden on desktop (md+). Respects safe-area-inset
 * for iOS home indicator.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, Wand2, ShoppingCart } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { cn } from '@/lib/utils'

const items = [
  { label: 'Trang chủ', href: '/', icon: Home, match: (p: string) => p === '/' },
  { label: 'Sản phẩm', href: '/san-pham', icon: Package, match: (p: string) => p.startsWith('/san-pham') || p.startsWith('/danh-muc') },
  { label: 'Xóa Giọng', href: '/cong-cu/xoa-giong-ai', icon: Wand2, match: (p: string) => p.startsWith('/cong-cu/xoa-giong-ai'), accent: true },
  { label: 'Giỏ hàng', href: '/gio-hang', icon: ShoppingCart, match: (p: string) => p.startsWith('/gio-hang'), showBadge: true },
]

export function MobileBottomBar() {
  const pathname = usePathname()
  const { itemCount } = useCart()

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Điều hướng nhanh"
    >
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          const active = it.match(pathname)
          const Icon = it.icon
          return (
            <li key={it.href} className="flex">
              <Link
                href={it.href}
                prefetch
                className={cn(
                  'relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium transition-colors active:bg-primary/5',
                  active
                    ? it.accent
                      ? 'text-fuchsia-400'
                      : 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative">
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-transform',
                      active && 'scale-110',
                      it.accent && active && 'drop-shadow-[0_0_8px_rgba(232,121,249,0.6)]'
                    )}
                  />
                  {it.showBadge && itemCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center px-1">
                      {itemCount > 99 ? '99+' : itemCount}
                    </span>
                  )}
                </span>
                <span className="leading-none tracking-tight">{it.label}</span>
                {active && (
                  <span
                    className={cn(
                      'absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full',
                      it.accent ? 'bg-fuchsia-400' : 'bg-primary'
                    )}
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
