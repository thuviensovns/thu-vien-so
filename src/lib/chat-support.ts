/**
 * Chat Support — auto-reply system with keyword matching.
 * Admin can customize greetings, auto-replies, and fallback messages.
 * All stored in localStorage for instant sync.
 */

export interface AutoReply {
  id: string
  keywords: string[]       // trigger keywords (lowercase)
  reply: string            // auto-reply message
  enabled: boolean
}

export interface ChatConfig {
  greeting: string              // first message when user opens chat
  fallbackReply: string         // when no keyword matches
  offlineMessage: string        // shown outside working hours (optional)
  botName: string               // display name
  botAvatar: string             // emoji or text
  autoReplies: AutoReply[]
  quickActions: string[]        // suggested quick reply buttons
}

export const defaultChatConfig: ChatConfig = {
  greeting: 'Xin chào! 👋 Chào mừng bạn đến với Thư Viện Số. Tôi có thể giúp gì cho bạn?',
  fallbackReply: 'Cảm ơn bạn đã liên hệ! Hiện tại tôi chưa có câu trả lời phù hợp. Vui lòng liên hệ qua email hoặc fanpage để được hỗ trợ chi tiết hơn nhé!',
  offlineMessage: '',
  botName: 'Hỗ trợ Thư Viện Số',
  botAvatar: '🎵',
  autoReplies: [
    {
      id: 'ar-1',
      keywords: ['giá', 'bao nhiêu', 'phí', 'trả phí', 'premium', 'mua'],
      reply: 'Chúng tôi có cả sản phẩm miễn phí và premium. Bạn có thể xem giá chi tiết tại trang sản phẩm. Nhiều tài nguyên hoàn toàn miễn phí! 🎁\n\n👉 Xem sản phẩm: /san-pham',
      enabled: true,
    },
    {
      id: 'ar-2',
      keywords: ['tải', 'download', 'tải về', 'link tải', 'không tải được'],
      reply: 'Để tải sản phẩm, bạn cần đăng nhập tài khoản. Sản phẩm miễn phí có thể tải ngay, sản phẩm premium cần thanh toán trước.\n\nNếu gặp lỗi khi tải, hãy thử:\n1. Đăng nhập lại\n2. Xóa cache trình duyệt\n3. Thử trình duyệt khác',
      enabled: true,
    },
    {
      id: 'ar-3',
      keywords: ['thanh toán', 'chuyển khoản', 'qr', 'nạp tiền', 'vnpay', 'momo', 'bank'],
      reply: 'Chúng tôi hỗ trợ thanh toán qua:\n• Chuyển khoản QR (xác nhận nhanh)\n• VNPay\n• MoMo\n\nBạn cũng có thể nạp tiền vào tài khoản để mua sản phẩm tiện hơn.\n\n👉 Nạp tiền: /nap-tien',
      enabled: true,
    },
    {
      id: 'ar-4',
      keywords: ['fl studio', 'cài đặt', 'hướng dẫn', 'sử dụng', 'cách dùng', 'tutorial'],
      reply: 'Bạn có thể tìm hướng dẫn sử dụng FL Studio và các tài nguyên tại trang Blog của chúng tôi.\n\n👉 Blog & Hướng dẫn: /blog\n👉 FAQ: /hoi-dap',
      enabled: true,
    },
    {
      id: 'ar-5',
      keywords: ['sample pack', 'sample', 'drum kit', 'loop', 'one shot'],
      reply: 'Chúng tôi có bộ sưu tập Sample Pack đa dạng: Drum Kit, Melody Loop, One-shot, FX cho nhiều thể loại nhạc.\n\n👉 Xem Sample Pack: /danh-muc/sample-pack',
      enabled: true,
    },
    {
      id: 'ar-6',
      keywords: ['flp', 'project', 'file project', 'fl project'],
      reply: 'FLP Project là file FL Studio hoàn chỉnh, bạn có thể mở và học hỏi kỹ thuật mixing, mastering.\n\n👉 Xem FLP: /danh-muc/flp',
      enabled: true,
    },
    {
      id: 'ar-7',
      keywords: ['vst', 'plugin', 'nexus', 'serum', 'sylenth', 'kontakt', 'spire'],
      reply: 'Chúng tôi có các VST Plugin phổ biến: Nexus, Serum, Sylenth1, Spire, Kontakt và nhiều hơn nữa.\n\n👉 Xem VST Plugin: /danh-muc/vst',
      enabled: true,
    },
    {
      id: 'ar-8',
      keywords: ['preset', 'bank', 'sound'],
      reply: 'Preset chất lượng cao cho Serum, Sylenth1, Massive, Spire — tiết kiệm thời gian sound design.\n\n👉 Xem Preset: /danh-muc/preset',
      enabled: true,
    },
    {
      id: 'ar-9',
      keywords: ['liên hệ', 'email', 'hỗ trợ', 'contact', 'support', 'admin'],
      reply: 'Bạn có thể liên hệ chúng tôi qua:\n• Email: support.thuvienso@gmail.com\n• Fanpage Facebook\n• Trang liên hệ: /lien-he\n\nChúng tôi phản hồi trong vòng 24 giờ!',
      enabled: true,
    },
    {
      id: 'ar-10',
      keywords: ['miễn phí', 'free', 'không mất tiền', 'tải free'],
      reply: 'Có nhiều sản phẩm miễn phí chất lượng cao! Bạn chỉ cần đăng nhập để tải.\n\n👉 Xem sản phẩm miễn phí: /san-pham?price=free',
      enabled: true,
    },
    {
      id: 'ar-11',
      keywords: ['cảm ơn', 'thank', 'thanks', 'ok', 'được rồi', 'tốt'],
      reply: 'Rất vui được hỗ trợ bạn! Nếu có thắc mắc gì thêm, đừng ngại hỏi nhé! 😊',
      enabled: true,
    },
    {
      id: 'ar-12',
      keywords: ['xin chào', 'hello', 'hi', 'chào', 'hey'],
      reply: 'Chào bạn! 👋 Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về sản phẩm, thanh toán, hoặc cách tải tài nguyên.',
      enabled: true,
    },
  ],
  quickActions: [
    'Sản phẩm miễn phí',
    'Cách thanh toán',
    'Hướng dẫn tải',
    'Liên hệ hỗ trợ',
  ],
}

const CHAT_CONFIG_KEY = 'admin_chat_config'

/** Get chat config (admin-configured or defaults) */
export function getChatConfig(): ChatConfig {
  if (typeof window === 'undefined') return defaultChatConfig
  try {
    const raw = localStorage.getItem(CHAT_CONFIG_KEY)
    if (!raw) return defaultChatConfig
    const parsed = JSON.parse(raw)
    // Migrate stale bot name
    if (typeof parsed.botName === 'string' && parsed.botName.includes('FL Studio')) {
      parsed.botName = defaultChatConfig.botName
      try { localStorage.setItem(CHAT_CONFIG_KEY, JSON.stringify(parsed)) } catch {}
    }
    return { ...defaultChatConfig, ...parsed }
  } catch {
    return defaultChatConfig
  }
}

/** Save chat config */
export function saveChatConfig(config: ChatConfig) {
  try {
    localStorage.setItem(CHAT_CONFIG_KEY, JSON.stringify(config))
    window.dispatchEvent(new StorageEvent('storage', { key: CHAT_CONFIG_KEY }))
  } catch {}
}

/** Find best matching auto-reply for a user message */
export function findAutoReply(message: string, config: ChatConfig): string {
  const lower = message.toLowerCase().trim()
  if (!lower) return config.fallbackReply

  let bestMatch: AutoReply | null = null
  let bestScore = 0

  for (const ar of config.autoReplies) {
    if (!ar.enabled) continue
    let score = 0
    for (const kw of ar.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += kw.length // longer keyword matches = higher priority
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = ar
    }
  }

  return bestMatch ? bestMatch.reply : config.fallbackReply
}
