import Link from 'next/link'

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-90 transition-opacity">
      <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center">
        <span className="text-lg leading-none" aria-hidden="true">♫</span>
        <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-secondary animate-pulse" />
      </div>
      <span className="font-heading text-lg font-bold tracking-tight">
        Thư Viện <span className="text-secondary">Số</span>
      </span>
    </Link>
  )
}
