/**
 * Content Spinner — pre-written content variations for admin to cycle through.
 * Each field has multiple alternatives; spin() picks a random one (different from current).
 */

export interface ContentVariations {
  heroTitle: string[]
  heroSubtitle: string[]
  heroBadge: string[]
  footerText: string[]
  metaTitle: string[]
  metaDescription: string[]
  announcementText: string[]
  categoryDescriptions: Record<string, string[]>
}

export const contentVariations: ContentVariations = {
  heroTitle: [
    'Thư Viện Số Việt Nam',
    'Kho Tài Nguyên Âm Nhạc #1 Việt Nam',
    'Thư Viện Số — Tài Nguyên Producer Việt',
    'Tài Nguyên Sản Xuất Nhạc Cho Producer Việt',
    'Download Tài Nguyên Âm Nhạc Miễn Phí',
    'Kho Nhạc Số Cho Producer Việt Nam',
    'Thư Viện Số — Nơi Bắt Đầu Sáng Tạo',
  ],
  heroSubtitle: [
    'Download Sample Pack, FLP Project, VST Plugin & Preset chất lượng cao. Tài nguyên EDM, Vinahouse dành riêng cho Producer Việt.',
    'Hàng ngàn tài nguyên âm nhạc chất lượng cao: Sample Pack, FLP, VST, Preset — hoàn toàn miễn phí và premium dành cho Producer Việt.',
    'Khám phá bộ sưu tập Sample Pack, FLP Project, Plugin & Preset chuyên nghiệp. Nâng tầm sản xuất nhạc của bạn ngay hôm nay.',
    'Tất cả những gì bạn cần cho sản xuất nhạc: từ Sample Pack, FLP đến VST Plugin. Tải miễn phí, chất lượng studio.',
    'Thư viện âm thanh khổng lồ dành cho Producer Việt. Sample Pack, FLP, VST, Preset — cập nhật liên tục mỗi tuần.',
    'Bắt đầu sáng tạo ngay với hàng trăm Sample Pack, FLP Project và VST Plugin chất lượng chuyên nghiệp.',
  ],
  heroBadge: [
    '',
    'Mới cập nhật hàng tuần',
    'Hơn 100+ tài nguyên miễn phí',
    'Dành riêng cho Producer Việt',
    'Free & Premium Resources',
    'Cập nhật liên tục 2025',
  ],
  footerText: [
    'Tài nguyên FLP, VST, Sample Pack cho Producer Việt Nam. Download miễn phí và premium cho Producer Việt.',
    'Nền tảng chia sẻ tài nguyên sản xuất nhạc lớn nhất Việt Nam. Hỗ trợ Producer từ cơ bản đến chuyên nghiệp.',
    'Kho tài nguyên âm nhạc số dành riêng cho cộng đồng Producer Việt. Cập nhật mỗi tuần.',
    'Cộng đồng Producer Việt Nam — chia sẻ Sample Pack, FLP, VST Plugin và kiến thức sản xuất nhạc.',
    'Thư viện tài nguyên âm nhạc chất lượng cao. Từ người mới bắt đầu đến Producer chuyên nghiệp.',
  ],
  metaTitle: [
    'Thư Viện Số — Tài nguyên cho Producer Việt',
    'Thư Viện Số — Download Sample Pack, FLP, VST miễn phí',
    'Thư Viện Số — Kho nhạc số #1 cho Producer Việt Nam',
    'Thư Viện Số — Tài nguyên sản xuất nhạc chất lượng cao',
    'Download tài nguyên âm nhạc — Sample Pack, FLP, VST, Preset',
  ],
  metaDescription: [
    'Download Sample Pack, FLP Project, VST Plugin & Preset miễn phí và premium cho Producer Việt.',
    'Kho tài nguyên âm nhạc lớn nhất Việt Nam: Sample Pack, FLP Project, VST Plugin, Preset. Download miễn phí ngay.',
    'Tải miễn phí Sample Pack, FLP Project, VST Plugin & Preset. Tài nguyên EDM, Vinahouse, Trap cho Producer Việt.',
    'Thư viện tài nguyên sản xuất nhạc chuyên nghiệp. Hàng trăm Sample Pack, FLP, VST, Preset miễn phí và premium.',
    'Download tài nguyên âm nhạc chất lượng cao. Sample Pack, FLP, VST, Preset dành cho Producer Việt Nam.',
  ],
  announcementText: [
    'Chào mừng bạn đến với Thư Viện Số! Khám phá hàng trăm tài nguyên miễn phí.',
    'Flash Sale cuối tuần — Giảm 30% tất cả sản phẩm Premium!',
    'Mới cập nhật: 10+ Sample Pack và FLP Project mới nhất tuần này!',
    'Đăng ký ngay để nhận ưu đãi độc quyền và tải miễn phí!',
    'Vinahouse Pack 2025 đã có — Tải ngay trước khi hết!',
  ],
  categoryDescriptions: {
    'sample-pack': [
      'Bộ sưu tập âm thanh chất lượng cao: Drum Kit, Melody Loop, One-shot, FX và nhiều hơn nữa cho mọi thể loại nhạc.',
      'Thư viện Sample Pack đa dạng: từ Drum Kit, Melody Loop đến FX chuyên nghiệp. Phù hợp EDM, Vinahouse, Trap, Future Bass.',
      'Kho âm thanh khổng lồ với hàng trăm Drum Kit, Melody Loop, One-shot. Chất lượng WAV 24-bit, sẵn sàng sử dụng.',
      'Sample Pack chất lượng studio: Kick, Snare, Hi-hat, Melody Loop, FX. Từ Vinahouse đến EDM, Trap, Lo-Fi.',
    ],
    'flp': [
      'File project FL Studio hoàn chỉnh, sẵn sàng mở và học hỏi kỹ thuật mixing, mastering từ các producer chuyên nghiệp.',
      'FLP Project đầy đủ: mở ngay trong FL Studio để học mix, master. Bao gồm Vinahouse, EDM, Trap, Future Bass.',
      'Bộ sưu tập FLP Project chuyên nghiệp. Phân tích cấu trúc bài nhạc, học kỹ thuật arrangement và mixing thực tế.',
      'File FL Studio Project sẵn sàng sử dụng: từ Vinahouse, EDM đến Lo-Fi, Trap. Học mixing từ project thực tế.',
    ],
    'vst': [
      'Plugin âm thanh chuyên nghiệp: Synthesizer, Effect, Instrument cho các DAW phổ biến.',
      'VST Plugin chất lượng cao: Nexus, Serum, Spire, Sylenth1, Kontakt và nhiều plugin khác cho sản xuất nhạc.',
      'Bộ sưu tập VST Plugin đa dạng: từ Synthesizer đến Effect Processor. Tương thích mọi DAW phổ biến.',
      'Kho VST Plugin phong phú: Synthesizer, Compressor, EQ, Reverb và các hiệu ứng chuyên nghiệp khác.',
    ],
    'preset': [
      'Preset chất lượng cao cho Serum, Sylenth1, Massive, Spire và các synth phổ biến khác.',
      'Bộ Preset chuyên nghiệp cho các VST phổ biến: Serum, Sylenth1, Massive, Spire. Âm thanh sẵn sàng sử dụng.',
      'Thư viện Preset đa dạng: Lead, Bass, Pad, Pluck cho Serum, Sylenth1, Massive. Tiết kiệm thời gian sound design.',
      'Preset bank chất lượng studio: EDM Lead, Vinahouse Bass, Future Bass Pluck. Cho Serum, Sylenth1, Spire.',
    ],
    'instrument': [
      'Nhạc cụ ảo chuyên nghiệp: Guitar, Piano, Violin, Drum và nhiều nhạc cụ khác cho sản xuất âm nhạc.',
      'Bộ sưu tập nhạc cụ ảo chất lượng: Ample Guitar, SWAM Strings, Piano và nhiều instrument khác cho Producer.',
      'Virtual Instrument chuyên nghiệp: từ Guitar acoustic đến Violin, Piano, Drum Kit. Âm thanh realistic chất lượng cao.',
      'Kho nhạc cụ ảo đa dạng: Guitar, Piano, Strings, Brass, Woodwind. Tương thích mọi DAW phổ biến.',
    ],
    'song-nhac-lyrics': [
      'Sóng nhạc, hiệu ứng lyrics video, template karaoke và các tài nguyên cho sản xuất video âm nhạc.',
      'Tài nguyên video âm nhạc: sóng nhạc visualizer, lyrics template, karaoke effect. Dùng cho YouTube, TikTok.',
      'Bộ sưu tập sóng nhạc và lyrics video: template After Effects, Premiere Pro. Tạo video nhạc chuyên nghiệp.',
      'Template sóng nhạc, lyrics video, visualizer cho sản xuất content âm nhạc trên YouTube và TikTok.',
    ],
  },
}

// --- Custom Variations (admin-saved, persisted in localStorage) ---

const CUSTOM_VARIATIONS_KEY = 'admin_custom_variations'

export interface CustomVariations {
  site: Partial<Record<string, string[]>>       // field -> custom strings[]
  categories: Partial<Record<string, string[]>>  // slug -> custom strings[]
}

/** Load admin-saved custom variations from localStorage */
export function getCustomVariations(): CustomVariations {
  if (typeof window === 'undefined') return { site: {}, categories: {} }
  try {
    const raw = localStorage.getItem(CUSTOM_VARIATIONS_KEY)
    return raw ? JSON.parse(raw) : { site: {}, categories: {} }
  } catch {
    return { site: {}, categories: {} }
  }
}

/** Save custom variations to localStorage */
export function saveCustomVariations(data: CustomVariations) {
  try {
    localStorage.setItem(CUSTOM_VARIATIONS_KEY, JSON.stringify(data))
    window.dispatchEvent(new StorageEvent('storage', { key: CUSTOM_VARIATIONS_KEY }))
  } catch {}
}

/** Add a custom variation for a site field. Returns false if duplicate. */
export function addCustomSiteVariation(field: string, value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const data = getCustomVariations()
  const existing = data.site[field] || []
  // Check duplicates in both built-in and custom
  const builtIn = (contentVariations as unknown as Record<string, string[]>)[field] as string[] | undefined
  if (builtIn?.includes(trimmed) || existing.includes(trimmed)) return false
  data.site[field] = [...existing, trimmed]
  saveCustomVariations(data)
  return true
}

/** Remove a custom variation for a site field */
export function removeCustomSiteVariation(field: string, index: number) {
  const data = getCustomVariations()
  const arr = data.site[field] || []
  arr.splice(index, 1)
  if (arr.length === 0) delete data.site[field]
  else data.site[field] = arr
  saveCustomVariations(data)
}

/** Add a custom variation for a category description. Returns false if duplicate. */
export function addCustomCategoryVariation(slug: string, value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const data = getCustomVariations()
  const existing = data.categories[slug] || []
  const builtIn = contentVariations.categoryDescriptions[slug] || []
  if (builtIn.includes(trimmed) || existing.includes(trimmed)) return false
  data.categories[slug] = [...existing, trimmed]
  saveCustomVariations(data)
  return true
}

/** Remove a custom variation for a category */
export function removeCustomCategoryVariation(slug: string, index: number) {
  const data = getCustomVariations()
  const arr = data.categories[slug] || []
  arr.splice(index, 1)
  if (arr.length === 0) delete data.categories[slug]
  else data.categories[slug] = arr
  saveCustomVariations(data)
}

/** Get full pool for a site field (built-in + custom) */
export function getFullSitePool(field: string): { builtIn: string[]; custom: string[] } {
  const builtIn = ((contentVariations as unknown as Record<string, string[]>)[field] as string[]) || []
  const custom = getCustomVariations().site[field] || []
  return { builtIn, custom }
}

/** Get full pool for a category (built-in + custom) */
export function getFullCategoryPool(slug: string): { builtIn: string[]; custom: string[] } {
  const builtIn = contentVariations.categoryDescriptions[slug] || []
  const custom = getCustomVariations().categories[slug] || []
  return { builtIn, custom }
}

/**
 * Pick a random variation different from the current value.
 * If current isn't in the pool or pool has only 1 item, pick randomly.
 */
export function spinOne(variations: string[], current: string): string {
  if (variations.length <= 1) return variations[0] || current
  const filtered = variations.filter((v) => v !== current)
  return filtered[Math.floor(Math.random() * filtered.length)]
}

/** Spin a site field using full pool (built-in + custom) */
export function spinSiteField(field: string, current: string): string {
  const { builtIn, custom } = getFullSitePool(field)
  const pool = [...builtIn, ...custom]
  if (pool.length === 0) return current
  return spinOne(pool, current)
}

/**
 * Spin all content fields at once. Returns a partial SiteSettings-like object.
 */
export function spinAllSiteContent(current: {
  heroTitle: string
  heroSubtitle: string
  heroBadge: string
  footerText: string
  metaTitle: string
  metaDescription: string
}) {
  return {
    heroTitle: spinSiteField('heroTitle', current.heroTitle),
    heroSubtitle: spinSiteField('heroSubtitle', current.heroSubtitle),
    heroBadge: spinSiteField('heroBadge', current.heroBadge),
    footerText: spinSiteField('footerText', current.footerText),
    metaTitle: spinSiteField('metaTitle', current.metaTitle),
    metaDescription: spinSiteField('metaDescription', current.metaDescription),
  }
}

/**
 * Spin a single category description using full pool.
 */
export function spinCategoryDescription(slug: string, current: string): string {
  const { builtIn, custom } = getFullCategoryPool(slug)
  const pool = [...builtIn, ...custom]
  if (pool.length === 0) return current
  return spinOne(pool, current)
}
