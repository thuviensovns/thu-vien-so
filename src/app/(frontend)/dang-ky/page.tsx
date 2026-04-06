'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus, Music, Loader2, AlertCircle, Eye, EyeOff, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export default function RegisterPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, register } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/tai-khoan')
    }
  }, [authLoading, user, router])

  const passwordChecks = {
    length: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }
  const passwordValid = passwordChecks.length && passwordChecks.hasLetter

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!passwordValid) {
      setError('Mật khẩu phải có ít nhất 8 ký tự và chứa chữ cái')
      return
    }

    setIsLoading(true)
    const result = await register({ displayName, email, password })
    if (result.ok) {
      toast.success('Đăng ký thành công!', { description: 'Hãy đăng nhập để tiếp tục.' })
      router.push('/dang-nhap?registered=true')
    } else {
      setError(result.error || 'Đăng ký thất bại')
      toast.error('Đăng ký thất bại', { description: result.error })
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
            <h1 className="text-2xl font-bold">Đăng ký</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tạo tài khoản để truy cập tài nguyên sản xuất nhạc
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="name" className="text-sm font-medium mb-1.5 block">Tên hiển thị</label>
              <Input
                id="name"
                type="text"
                placeholder="Tên của bạn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
                disabled={isLoading}
                className="bg-muted/50"
              />
            </div>
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
                  placeholder="Tối thiểu 8 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
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
              {/* Password strength indicators */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <PasswordCheck ok={passwordChecks.length} label="Ít nhất 8 ký tự" />
                  <PasswordCheck ok={passwordChecks.hasLetter} label="Có chữ cái" />
                  <PasswordCheck ok={passwordChecks.hasNumber} label="Có chữ số" />
                </div>
              )}
            </div>
            <Button
              type="submit"
              disabled={isLoading || (password.length > 0 && !passwordValid)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
            </Button>
          </form>

          <Separator className="my-6" />

          <p className="text-center text-sm text-muted-foreground">
            Đã có tài khoản?{' '}
            <Link href="/dang-nhap" className="text-primary hover:underline font-medium">
              Đăng nhập
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function PasswordCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-success' : 'text-muted-foreground'}`}>
      <Check className={`h-3 w-3 ${ok ? 'opacity-100' : 'opacity-30'}`} />
      {label}
    </div>
  )
}
