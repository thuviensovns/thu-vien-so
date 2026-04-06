'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MessageCircle, Save, Plus, Trash2, Check, RotateCcw,
  ToggleLeft, ToggleRight, Tag, MessageSquare, Bot, Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getChatConfig, saveChatConfig, defaultChatConfig,
  type ChatConfig, type AutoReply,
} from '@/lib/chat-support'
import { logActivity } from '@/lib/admin-helpers'

export default function ChatSupportPage() {
  const [config, setConfig] = useState<ChatConfig>(defaultChatConfig)
  const [saved, setSaved] = useState(false)
  const [editingReply, setEditingReply] = useState<string | null>(null)

  const refresh = useCallback(() => setConfig(getChatConfig()), [])

  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'admin_chat_config') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleSave = (updated: ChatConfig) => {
    setConfig(updated)
    saveChatConfig(updated)
    showSaved()
  }

  // Update a top-level field
  const updateField = (field: keyof ChatConfig, value: any) => {
    handleSave({ ...config, [field]: value })
  }

  // Add new auto-reply
  const addAutoReply = () => {
    const newReply: AutoReply = {
      id: `ar-${Date.now()}`,
      keywords: ['từ khóa mới'],
      reply: 'Nội dung trả lời tự động...',
      enabled: true,
    }
    handleSave({ ...config, autoReplies: [...config.autoReplies, newReply] })
    setEditingReply(newReply.id)
    logActivity('settings', 'Thêm auto-reply', `ID: ${newReply.id}`)
  }

  // Update an auto-reply
  const updateAutoReply = (id: string, updates: Partial<AutoReply>) => {
    const updated = config.autoReplies.map(ar =>
      ar.id === id ? { ...ar, ...updates } : ar
    )
    handleSave({ ...config, autoReplies: updated })
  }

  // Delete an auto-reply
  const deleteAutoReply = (id: string) => {
    const reply = config.autoReplies.find(ar => ar.id === id)
    handleSave({ ...config, autoReplies: config.autoReplies.filter(ar => ar.id !== id) })
    if (reply) logActivity('settings', 'Xóa auto-reply', reply.keywords.join(', '))
  }

  // Toggle auto-reply
  const toggleAutoReply = (id: string) => {
    const ar = config.autoReplies.find(r => r.id === id)
    if (ar) updateAutoReply(id, { enabled: !ar.enabled })
  }

  // Quick action management
  const addQuickAction = () => {
    const name = prompt('Nhập tên nút gợi ý:')
    if (name?.trim()) {
      handleSave({ ...config, quickActions: [...config.quickActions, name.trim()] })
    }
  }

  const removeQuickAction = (index: number) => {
    const updated = [...config.quickActions]
    updated.splice(index, 1)
    handleSave({ ...config, quickActions: updated })
  }

  // Reset all
  const handleResetAll = () => {
    handleSave(defaultChatConfig)
    logActivity('settings', 'Reset chat support', 'Đã khôi phục cấu hình chat mặc định')
  }

  // Save all with activity log
  const handleSaveAll = () => {
    saveChatConfig(config)
    showSaved()
    logActivity('settings', 'Cập nhật chat support', 'Đã lưu cấu hình chat hỗ trợ')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Chat Hỗ Trợ
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý chatbot tự động — tin nhắn chào, auto-reply và nút gợi ý
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-success flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Đã lưu
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleResetAll} className="text-xs">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSaveAll} className="text-xs">
            <Save className="h-3.5 w-3.5 mr-1" />
            Lưu tất cả
          </Button>
        </div>
      </div>

      {/* Bot Settings */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 sm:p-5">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Cài đặt Bot
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Tên Bot</label>
              <Input
                value={config.botName}
                onChange={(e) => updateField('botName', e.target.value)}
                className="text-xs bg-muted/30"
                placeholder="Hỗ trợ Thư Viện Số"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Avatar (emoji)</label>
              <Input
                value={config.botAvatar}
                onChange={(e) => updateField('botAvatar', e.target.value)}
                className="text-xs bg-muted/30"
                placeholder="🎵"
                maxLength={4}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 sm:p-5">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Tin nhắn hệ thống
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Tin nhắn chào mừng</label>
              <p className="text-[10px] text-muted-foreground mb-1">Hiển thị khi người dùng mở chat lần đầu</p>
              <textarea
                value={config.greeting}
                onChange={(e) => updateField('greeting', e.target.value)}
                rows={2}
                className="w-full text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Tin nhắn mặc định (không khớp từ khóa)</label>
              <p className="text-[10px] text-muted-foreground mb-1">Khi không tìm thấy auto-reply phù hợp</p>
              <textarea
                value={config.fallbackReply}
                onChange={(e) => updateField('fallbackReply', e.target.value)}
                rows={2}
                className="w-full text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Nút gợi ý nhanh
              <Badge variant="outline" className="text-[9px]">{config.quickActions.length}</Badge>
            </h3>
            <Button variant="outline" size="sm" onClick={addQuickAction} className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Thêm
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">
            Các nút gợi ý hiển thị khi chat mới mở — giúp người dùng bắt đầu nhanh hơn
          </p>
          <div className="flex flex-wrap gap-2">
            {config.quickActions.map((action, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs"
              >
                <span className="text-primary">{action}</span>
                <button
                  onClick={() => removeQuickAction(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {config.quickActions.length === 0 && (
              <p className="text-xs text-muted-foreground">Chưa có nút gợi ý nào</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto Replies */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Auto-Reply (Trả lời tự động)
              <Badge variant="outline" className="text-[9px]">
                {config.autoReplies.filter(ar => ar.enabled).length}/{config.autoReplies.length} đang bật
              </Badge>
            </h3>
            <Button size="sm" onClick={addAutoReply} className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Thêm mới
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mb-4">
            Khi tin nhắn người dùng chứa từ khóa, bot sẽ trả lời tự động với nội dung tương ứng
          </p>

          <div className="space-y-3">
            {config.autoReplies.map((ar) => {
              const isEditing = editingReply === ar.id
              return (
                <div
                  key={ar.id}
                  className={`border rounded-xl p-3 transition-colors ${
                    ar.enabled ? 'border-border bg-card' : 'border-border/50 bg-muted/20 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleAutoReply(ar.id)}
                      className="mt-0.5 shrink-0"
                      title={ar.enabled ? 'Tắt' : 'Bật'}
                    >
                      {ar.enabled ? (
                        <ToggleRight className="h-5 w-5 text-success" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      {/* Keywords */}
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {ar.keywords.map((kw, ki) => (
                          <Badge key={ki} variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">
                            {kw}
                          </Badge>
                        ))}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
                              Từ khóa (phân cách bằng dấu phẩy)
                            </label>
                            <Input
                              value={ar.keywords.join(', ')}
                              onChange={(e) => updateAutoReply(ar.id, {
                                keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                              })}
                              className="text-xs bg-muted/30 h-8"
                              placeholder="từ khóa 1, từ khóa 2, ..."
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
                              Nội dung trả lời
                            </label>
                            <textarea
                              value={ar.reply}
                              onChange={(e) => updateAutoReply(ar.id, { reply: e.target.value })}
                              rows={3}
                              className="w-full text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => setEditingReply(null)}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Xong
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line leading-relaxed">
                          {ar.reply}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!isEditing && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => setEditingReply(ar.id)}
                          title="Sửa"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteAutoReply(ar.id)}
                        title="Xóa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}

            {config.autoReplies.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Chưa có auto-reply nào. Nhấn "Thêm mới" để tạo.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <h3 className="text-xs font-bold mb-2 text-primary">Hướng dẫn</h3>
          <ul className="text-[11px] text-muted-foreground space-y-1 leading-relaxed">
            <li>• Bot tự động trả lời dựa trên từ khóa trong tin nhắn người dùng.</li>
            <li>• Mỗi auto-reply có thể chứa nhiều từ khóa — bot chọn reply có nhiều từ khóa khớp nhất.</li>
            <li>• Dùng đường dẫn /san-pham, /lien-he, v.v. trong nội dung trả lời — sẽ thành link click được.</li>
            <li>• Nút gợi ý nhanh giúp người dùng không biết hỏi gì có thể bắt đầu dễ dàng.</li>
            <li>• Tắt/bật từng auto-reply mà không cần xóa.</li>
            <li>• Thay đổi cập nhật ngay lập tức — không cần build lại.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
