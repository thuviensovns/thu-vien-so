import { categoryMeta } from '@/lib/config'

/** Product data shape used across the codebase */
export interface DemoProduct {
  id: string
  name: string
  slug: string
  type: string
  thumbnail: { url: string }
  thumbnailUrl?: string
  pricing: { price: number; originalPrice?: number | null; isFree?: boolean }
  preview?: { bpm?: number | null; musicalKey?: string | null; audioFile?: { url: string } | null; duration?: number | null }
  downloadCount: number
  featured?: boolean
  category?: { slug: string; name: string }
  file?: { r2Key?: string; fileName?: string; fileSize?: number; fileFormat?: string; downloadUrl?: string }
  compatibility?: { daw?: string; version?: string }[]
  tags?: { tag?: string }[]
  updatedAt: string
}

export const demoCategoryDescriptions: Record<string, string> = {
  'sample-pack': 'Bộ sưu tập âm thanh chất lượng cao: Drum Kit, Melody Loop, One-shot, FX và nhiều hơn nữa cho mọi thể loại nhạc.',
  'flp': 'File project FL Studio hoàn chỉnh, sẵn sàng mở và học hỏi kỹ thuật mixing, mastering từ các producer chuyên nghiệp.',
  'vst': 'Plugin âm thanh chuyên nghiệp: Synthesizer, Effect, Instrument cho các DAW phổ biến.',
  'preset': 'Preset chất lượng cao cho Serum, Sylenth1, Massive, Spire và các synth phổ biến khác.',
  'instrument': 'Nhạc cụ ảo chuyên nghiệp: Guitar, Piano, Violin, Drum và nhiều nhạc cụ khác cho sản xuất âm nhạc.',
  'song-nhac-lyrics': 'Sóng nhạc, hiệu ứng lyrics video, template karaoke và các tài nguyên cho sản xuất video âm nhạc.',
  'cai-dat-phan-mem': 'Dịch vụ cài đặt phần mềm âm nhạc: FL Studio, Ableton, Logic Pro, và các DAW chuyên nghiệp khác.',
}

/** Get admin-overridden category descriptions (client-only, reads localStorage) */
export function getCategoryDescriptions(): Record<string, string> {
  if (typeof window === 'undefined') return demoCategoryDescriptions
  try {
    const raw = localStorage.getItem('admin_category_descriptions')
    return raw ? { ...demoCategoryDescriptions, ...JSON.parse(raw) } : demoCategoryDescriptions
  } catch {
    return demoCategoryDescriptions
  }
}

/** Debounced DB sync for category descriptions */
let _catDescsDbTimer: ReturnType<typeof setTimeout> | null = null

function syncCatDescsToDb(descs: Record<string, string>) {
  if (_catDescsDbTimer) clearTimeout(_catDescsDbTimer)
  _catDescsDbTimer = setTimeout(() => {
    fetch('/api/site-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ categoryDescriptions: descs }),
    }).then(res => {
      if (!res.ok) console.warn('[SiteContent] DB category save failed:', res.status)
    }).catch(() => {
      console.warn('[SiteContent] DB category save failed: network error')
    })
  }, 1500)
}

/** Save admin category description overrides — localStorage instant, DB debounced */
export function saveCategoryDescriptions(descs: Record<string, string>) {
  try {
    localStorage.setItem('admin_category_descriptions', JSON.stringify(descs))
    window.dispatchEvent(new StorageEvent('storage', { key: 'admin_category_descriptions' }))
  } catch {}
  syncCatDescsToDb(descs)
}
