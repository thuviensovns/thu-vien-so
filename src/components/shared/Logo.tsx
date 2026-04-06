import Link from 'next/link'
import { Music } from 'lucide-react'

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-90 transition-opacity">
      <Music className="h-7 w-7" />
      <span className="font-heading text-lg font-bold tracking-tight">
        Thư Viện <span className="text-secondary">Số</span>
      </span>
    </Link>
  )
}
