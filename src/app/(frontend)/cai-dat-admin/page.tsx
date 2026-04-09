'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

export default function SetupAdminPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    fetch('/api/setup')
      .then(res => res.json())
      .then(data => {
        if (data.needsSetup) {
          setNeedsSetup(true)
        } else {
          router.replace('/dang-nhap')
        }
      })
      .catch(() => setError('Không thể kết nối đến server'))
      .finally(() => setChecking(false))
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      })
      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push('/dang-nhap'), 2000)
      } else {
        setError(data.error || 'Không thể tạo tài khoản')
      }
    } catch {
      setError('Lỗi kết nối server')
    } finally {
      setIsLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!needsSetup) return null

  if (success) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-[60vh] px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Tạo admin thành công!</h2>
            <p className="text-muted-foreground">Đang chuyển đến trang đăng nhập...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[60vh] sm:min-h-[70vh] px-4 py-8">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Thiết lập Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tạo tài khoản quản trị viên đầu tiên
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="text-sm font-medium mb-1.5 block">Tên hiển thị</label>
              <Input
                id="displayName"
                type="text"
                placeholder="Admin"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                className="bg-muted/50"
              />
            </div>
            <div>
              <label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                <Shield className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Đang tạo...' : 'Tạo tài khoản Admin'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
