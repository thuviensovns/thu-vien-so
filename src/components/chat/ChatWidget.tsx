'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, Send, ChevronDown } from 'lucide-react'
import { getChatConfig, findAutoReply, type ChatConfig } from '@/lib/chat-support'
import Link from 'next/link'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: number
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

/** Render message text with internal links (/path) as clickable */
function MessageText({ text }: { text: string }) {
  const parts = text.split(/(\/[a-z0-9-]+(?:\?[a-z0-9=&]+)?)/gi)
  return (
    <>
      {parts.map((part, i) =>
        /^\/[a-z0-9-]/i.test(part) ? (
          <Link key={i} href={part} className="text-primary underline hover:no-underline font-medium">
            {part}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [config, setConfig] = useState<ChatConfig | null>(null)
  const [typing, setTyping] = useState(false)
  const [hasNewMessage, setHasNewMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refreshConfig = useCallback(() => setConfig(getChatConfig()), [])

  useEffect(() => {
    refreshConfig()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_chat_config') refreshConfig()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refreshConfig])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleOpen = () => {
    setOpen(true)
    setHasNewMessage(false)
    // Show greeting on first open
    if (messages.length === 0 && config) {
      setMessages([{
        id: `msg-${Date.now()}`,
        text: config.greeting,
        sender: 'bot',
        timestamp: Date.now(),
      }])
    }
  }

  const sendMessage = (text: string) => {
    if (!text.trim() || !config) return

    const userMsg: Message = {
      id: `msg-${Date.now()}-u`,
      text: text.trim(),
      sender: 'user',
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    // Simulate typing delay then auto-reply
    setTyping(true)
    const delay = 500 + Math.random() * 1000
    setTimeout(() => {
      const reply = findAutoReply(text, config)
      const botMsg: Message = {
        id: `msg-${Date.now()}-b`,
        text: reply,
        sender: 'bot',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, botMsg])
      setTyping(false)
      if (!open) setHasNewMessage(true)
    }, delay)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuickAction = (action: string) => {
    sendMessage(action)
  }

  if (!config) return null

  return (
    <>
      {/* Chat bubble button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] md:bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
          aria-label="Mở chat hỗ trợ"
        >
          <MessageCircle className="h-6 w-6" />
          {hasNewMessage && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full border-2 border-background animate-pulse" />
          )}
          {/* Tooltip */}
          <span className="absolute right-full mr-3 whitespace-nowrap bg-card border border-border text-foreground text-xs px-3 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Chat hỗ trợ
          </span>
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] md:bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-40px)] h-[520px] max-h-[calc(100vh-100px-64px)] md:max-h-[calc(100vh-100px)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center text-lg">
              {config.botAvatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{config.botName}</p>
              <p className="text-[10px] opacity-80 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
                Trực tuyến
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 rounded-lg hover:bg-primary-foreground/20 flex items-center justify-center transition-colors"
              aria-label="Đóng chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] ${msg.sender === 'user' ? 'order-1' : ''}`}>
                  {msg.sender === 'bot' && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{config.botAvatar}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{config.botName}</span>
                    </div>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed whitespace-pre-line ${
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted/60 text-foreground rounded-bl-md border border-border/50'
                    }`}
                  >
                    {msg.sender === 'bot' ? <MessageText text={msg.text} /> : msg.text}
                  </div>
                  <p className={`text-[9px] text-muted-foreground mt-0.5 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex justify-start">
                <div className="max-w-[85%]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{config.botAvatar}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">{config.botName}</span>
                  </div>
                  <div className="bg-muted/60 border border-border/50 rounded-2xl rounded-bl-md px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions - show only when few messages */}
          {messages.length <= 2 && config.quickActions.length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {config.quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => handleQuickAction(action)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-2.5 border-t border-border shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="flex-1 text-sm bg-muted/30 border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
                disabled={typing}
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
