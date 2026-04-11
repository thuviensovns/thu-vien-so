'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { User, LogIn, LogOut, Download, Settings, ShieldCheck, Wallet, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { useBalance } from '@/hooks/use-balance'
import { formatVND } from '@/lib/format'

function getInboxSeenKey(email: string) {
  return `tvs:inbox-seen:${email.toLowerCase()}`
}

export function UserMenu() {
  const { user, logout } = useAuth()
  const { balance } = useBalance()
  const router = useRouter()
  const [hasUnreadReply, setHasUnreadReply] = useState(false)

  // Poll /api/my-messages every 30s and compare latestReplyAt against localStorage.
  // If admin added a reply after the last time the customer opened /tin-nhan,
  // show a dot next to the "Tin nhắn" menu item.
  useEffect(() => {
    if (!user?.email) { setHasUnreadReply(false); return }
    let cancelled = false

    async function check() {
      try {
        const res = await fetch('/api/my-messages', { credentials: 'include', cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const latest: string | null = data?.latestReplyAt || null
        if (!latest) { setHasUnreadReply(false); return }
        const seenRaw = localStorage.getItem(getInboxSeenKey(user!.email))
        const seenAt = seenRaw ? new Date(seenRaw).getTime() : 0
        setHasUnreadReply(new Date(latest).getTime() > seenAt)
      } catch { /* ignore */ }
    }

    check()
    const interval = setInterval(check, 30000)
    const onFocus = () => check()
    const onCustom = () => check()
    window.addEventListener('focus', onFocus)
    window.addEventListener('inbox:refresh', onCustom)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('inbox:refresh', onCustom)
    }
  }, [user?.email])

  if (!user) {
    return (
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary">
        <Link href="/dang-nhap">
          <LogIn className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">Đăng nhập</span>
        </Link>
      </Button>
    )
  }

  const isAdmin = user.role === 'admin'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary" aria-label="Menu tài khoản">
          <User className="h-5 w-5" />
          <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ${isAdmin ? 'bg-warning' : 'bg-accent'}`} />
          {hasUnreadReply && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive animate-pulse" aria-label="Phản hồi mới" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border-border">
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{user.displayName || user.email}</p>
            {isAdmin && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning/10 text-warning border border-warning/20">
                ADMIN
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>

        {/* Balance display */}
        <div className="px-2 pb-1">
          <Link
            href="/nap-tien"
            className="flex items-center justify-between px-2 py-1.5 rounded-md bg-success/5 border border-success/10 hover:bg-success/10 transition-colors"
          >
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-success" />
              Số dư
            </span>
            <span className="text-sm font-bold text-success">{formatVND(balance)}</span>
          </Link>
        </div>

        <DropdownMenuSeparator />

        {/* Admin Panel — only for admin role */}
        {isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/quan-ly" className="cursor-pointer text-warning focus:text-warning">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Admin Panel
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem asChild>
          <Link href="/tin-nhan" className="cursor-pointer">
            <Mail className="mr-2 h-4 w-4" />
            <span className="flex-1">Tin nhắn</span>
            {hasUnreadReply && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                Mới
              </span>
            )}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/tai-khoan" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Tài khoản
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/tai-khoan?tab=downloads" className="cursor-pointer">
            <Download className="mr-2 h-4 w-4" />
            Downloads
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/nap-tien" className="cursor-pointer">
            <Wallet className="mr-2 h-4 w-4 text-success" />
            Nạp tiền
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={async () => {
            await logout()
            router.push('/')
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
