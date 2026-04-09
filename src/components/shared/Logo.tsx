'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function Logo() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const logoSrc = mounted && resolvedTheme === 'light' ? '/logo-light.svg' : '/logo.svg'

  return (
    <Link href="/" className="flex items-center hover:opacity-90 transition-opacity shrink-0">
      <Image
        src={logoSrc}
        alt="Thư Viện Số"
        width={160}
        height={38}
        className="h-8 sm:h-9 w-auto"
        priority
      />
    </Link>
  )
}

/** Icon-only logo for compact spaces */
export function LogoIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <Link href="/" className="flex items-center hover:opacity-90 transition-opacity shrink-0">
      <Image
        src="/logo-icon.svg"
        alt="Thư Viện Số"
        width={40}
        height={40}
        className={className}
      />
    </Link>
  )
}
