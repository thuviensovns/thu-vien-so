'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { CartContext, useCartState } from '@/hooks/use-cart'
import { AuthContext, useAuthState } from '@/hooks/use-auth'
import { BalanceContext, useBalanceState } from '@/hooks/use-balance'
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog'

export function Providers({ children }: { children: React.ReactNode }) {
  const cart = useCartState()
  const auth = useAuthState()
  const balance = useBalanceState()

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      <AuthContext.Provider value={auth}>
        <BalanceContext.Provider value={balance}>
          <CartContext.Provider value={cart}>
            {children}
            <ConfirmDialogProvider />
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: 'bg-card text-card-foreground border-border',
                duration: 3000,
              }}
              richColors
              closeButton
            />
          </CartContext.Provider>
        </BalanceContext.Provider>
      </AuthContext.Provider>
    </ThemeProvider>
  )
}
