'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogIn, Music, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const justRegistered = searchParams.get('registered') === 'true'

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/tai-khoan')
    }
  }, [authLoading, user, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const result = await login(email, password)
    if (result.ok) {
      toast.success('Đăng nhập thành công!')
      router.push('/tai-khoan')
    } else {
      setError(result.error || 'Đăng nhập thất bại')
      toast.error('Đăng nhập thất bại', { description: result.error })
      setIsLoading(false)
    }
  }

  // Don't show form if already logged in
  if (!authLoading && user) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-[60vh] px-4 py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[60vh] sm:min-h-[70vh] px-4 py-8">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Music className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Đăng nhập</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Đăng nhập để mua và tải sản phẩm
            </p>
          </div>

          {/* Success message after registration */}
          {justRegistered && !error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Đăng ký thành công! Hãy đăng nhập để tiếp tục.
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
                className="bg-muted/50"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium mb-1.5 block">Mật khẩu</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="bg-muted/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>


          <Separator className="my-6" />

          <p className="text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{' '}
            <Link href="/dang-ky" className="text-primary hover:underline font-medium">
              Đăng ký ngay
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
