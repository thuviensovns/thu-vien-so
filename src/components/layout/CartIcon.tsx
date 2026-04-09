'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/hooks/use-cart'

export function CartIcon() {
  const { itemCount } = useCart()

  return (
    <Button variant="ghost" size="icon" asChild className="relative text-muted-foreground hover:text-primary" aria-label="Giỏ hàng">
      <Link href="/gio-hang">
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center px-0.5 animate-in zoom-in-50 duration-200">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </Link>
    </Button>
  )
}
