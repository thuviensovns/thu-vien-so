'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Send, Loader2, CheckCircle, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

export function ContactForm() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Auto-fill name & email from logged-in user
  useEffect(() => {
    if (user) {
      if (user.displayName && !name) setName(user.displayName)
      if (user.email && !email) setEmail(user.email)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || !message) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      })
      let data: { error?: string; success?: boolean }
      try {
        data = await res.json()
      } catch {
        data = {}
      }
      if (!res.ok) {
        toast.error(data.error || 'Đã có lỗi xảy ra, vui lòng thử lại.')
        return
      }
      setSubmitted(true)
      toast.success('Tin nhắn đã được gửi!', {
        description: 'Chúng tôi sẽ phản hồi trong vòng 24 giờ.',
      })
    } catch {
      toast.error('Không thể kết nối đến máy chủ, vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
        <h3 className="font-bold text-lg">Cảm ơn bạn!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Tin nhắn đã được gửi. Chúng tôi sẽ phản hồi sớm nhất có thể.
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          {user && (
            <Button variant="default" size="sm" asChild>
              <Link href="/tin-nhan">
                <Inbox className="h-3.5 w-3.5 mr-1.5" />
                Xem hộp thư
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSubmitted(false)
              setName(user?.displayName || '')
              setEmail(user?.email || '')
              setSubject('')
              setMessage('')
            }}
          >
            Gửi tin nhắn khác
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-name" className="text-sm font-medium mb-1.5 block">Họ tên *</label>
          <Input
            id="contact-name"
            type="text"
            placeholder="Tên của bạn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isSubmitting}
            className="bg-muted/50"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="text-sm font-medium mb-1.5 block">Email *</label>
          <Input
            id="contact-email"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting || !!user}
            className={`bg-muted/50 ${user ? 'opacity-70' : ''}`}
          />
          {user && (
            <p className="text-[10px] text-muted-foreground mt-1">Email tài khoản đăng nhập</p>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="contact-subject" className="text-sm font-medium mb-1.5 block">Tiêu đề</label>
        <Input
          id="contact-subject"
          type="text"
          placeholder="Chủ đề tin nhắn"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={isSubmitting}
          className="bg-muted/50"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="text-sm font-medium mb-1.5 block">Nội dung *</label>
        <textarea
          id="contact-message"
          placeholder="Nhập nội dung tin nhắn..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          disabled={isSubmitting}
          rows={5}
          className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none resize-none disabled:opacity-50"
        />
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isSubmitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        {isSubmitting ? 'Đang gửi...' : 'Gửi tin nhắn'}
      </Button>
    </form>
  )
}
