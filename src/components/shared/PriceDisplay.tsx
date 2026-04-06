'use client'

import { Badge } from '@/components/ui/badge'
import { formatVND } from '@/lib/format'

interface PriceDisplayProps {
  price: number
  originalPrice?: number | null
  isFree?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function PriceDisplay({ price, originalPrice, isFree, size = 'md' }: PriceDisplayProps) {
  if (isFree || price === 0) {
    return (
      <Badge variant="secondary" className="bg-accent text-accent-foreground font-semibold">
        Miễn phí
      </Badge>
    )
  }

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`font-bold text-primary ${sizeClasses[size]}`}>
        {formatVND(price)}
      </span>
      {originalPrice && originalPrice > price && (
        <span className="text-muted-foreground line-through text-sm">
          {formatVND(originalPrice)}
        </span>
      )}
    </div>
  )
}
