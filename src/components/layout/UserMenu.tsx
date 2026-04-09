'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

export function UserMenu() {
  const { user, logout } = useAuth()
  const { balance } = useBalance()
  const router = useRouter()

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
            Tin nhắn
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
