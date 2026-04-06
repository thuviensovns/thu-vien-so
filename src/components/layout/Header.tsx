import { Logo } from '@/components/shared/Logo'
import { MainNav } from './MainNav'
import { SearchBar } from './SearchBar'
import { CartIcon } from './CartIcon'
import { UserMenu } from './UserMenu'
import { MobileNav } from './MobileNav'
import { ThemeToggle } from '@/components/shared/ThemeToggle'

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg transition-theme">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 px-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <MobileNav />
          <Logo />
        </div>
        <MainNav />
        <div className="flex items-center gap-0.5 sm:gap-1">
          <SearchBar />
          <ThemeToggle />
          <CartIcon />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
