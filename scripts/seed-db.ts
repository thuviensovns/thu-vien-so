/**
 * Seed database with demo products and categories via Payload Local API.
 * Run: npx tsx scripts/seed-db.ts
 */

const API = 'http://localhost:3000/api'
const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'
const ADMIN_PASSWORD = 'Anhdungpro1@'

interface Category {
  slug: string
  name: string
  description: string
  order: number
}

interface Product {
  name: string
  slug: string
  type: string
  categorySlug: string
  price: number
  originalPrice?: number
  isFree?: boolean
  downloadCount: number
  featured?: boolean
  bpm?: number
  musicalKey?: string
  updatedAt?: string
}

const categories: Category[] = [
  { slug: 'sample-pack', name: 'Sample Pack', description: 'Bộ sưu tập âm thanh chất lượng cao cho mọi thể loại nhạc.', order: 1 },
  { slug: 'flp', name: 'FLP Project', description: 'File project FL Studio hoàn chỉnh.', order: 2 },
  { slug: 'vst', name: 'VST Plugin', description: 'Plugin âm thanh chuyên nghiệp cho FL Studio.', order: 3 },
  { slug: 'preset', name: 'Preset', description: 'Preset chất lượng cao cho các synth phổ biến.', order: 4 },
  { slug: 'instrument', name: 'Instrument', description: 'Nhạc cụ ảo chuyên nghiệp cho sản xuất âm nhạc.', order: 5 },
  { slug: 'song-nhac-lyrics', name: 'Sóng nhạc Lyrics', description: 'Sóng nhạc, hiệu ứng lyrics video, template karaoke.', order: 6 },
]

const products: Product[] = [
  // Sóng nhạc Lyrics
  { name: 'Sóng nhạc Ballad Việt Pack', slug: 'song-nhac-ballad-viet', type: 'song-nhac-lyrics', categorySlug: 'song-nhac-lyrics', price: 99000, downloadCount: 890, featured: true },
  { name: 'Lyrics Video Template Pack', slug: 'lyrics-video-template', type: 'song-nhac-lyrics', categorySlug: 'song-nhac-lyrics', price: 0, isFree: true, downloadCount: 2300 },
  { name: 'Karaoke Wave Effect Bundle', slug: 'karaoke-wave-effect', type: 'song-nhac-lyrics', categorySlug: 'song-nhac-lyrics', price: 149000, originalPrice: 249000, downloadCount: 560 },

  // VST Plugins
  { name: 'Nexus 4 Full Bank', slug: 'nexus-4-full-bank', type: 'vst', categorySlug: 'vst', price: 499000, originalPrice: 799000, downloadCount: 2300, featured: true },
  { name: 'Serum Preset Pack + Skin', slug: 'serum-preset-pack-skin', type: 'vst', categorySlug: 'vst', price: 299000, downloadCount: 1800 },
  { name: 'Spire Full Collection', slug: 'spire-full-collection', type: 'vst', categorySlug: 'vst', price: 399000, originalPrice: 599000, downloadCount: 945 },
  { name: 'Kontakt Library Essential', slug: 'kontakt-library-essential', type: 'vst', categorySlug: 'vst', price: 0, isFree: true, downloadCount: 6700 },

  // FLP Projects
  { name: 'Vinahouse Full Project 2024', slug: 'vinahouse-full-project-2024', type: 'flp', categorySlug: 'flp', price: 299000, originalPrice: 499000, downloadCount: 890, featured: true, bpm: 130, musicalKey: 'Am' },
  { name: 'Future Bass FLP Template', slug: 'future-bass-flp-template', type: 'flp', categorySlug: 'flp', price: 0, isFree: true, downloadCount: 5600, bpm: 150, musicalKey: 'Cm' },
  { name: 'Tropical House FL Studio Project', slug: 'tropical-house-flp', type: 'flp', categorySlug: 'flp', price: 199000, downloadCount: 1200, bpm: 110, musicalKey: 'Gm' },
  { name: 'Remix Mashup FLP Pack', slug: 'remix-mashup-flp', type: 'flp', categorySlug: 'flp', price: 349000, downloadCount: 430, bpm: 128 },

  // Presets
  { name: 'Sylenth1 EDM Preset Pack', slug: 'sylenth1-edm-preset', type: 'preset', categorySlug: 'preset', price: 149000, downloadCount: 1450, featured: true },
  { name: 'Massive X Trap Presets', slug: 'massive-x-trap-presets', type: 'preset', categorySlug: 'preset', price: 0, isFree: true, downloadCount: 3200 },
  { name: 'Serum Future House Pack', slug: 'serum-future-house', type: 'preset', categorySlug: 'preset', price: 199000, originalPrice: 299000, downloadCount: 780 },

  // Sample Packs
  { name: 'Vinahouse Drum Kit Vol.1', slug: 'vinahouse-drum-kit-vol1', type: 'sample-pack', categorySlug: 'sample-pack', price: 199000, originalPrice: 299000, downloadCount: 1234, featured: true, bpm: 130, musicalKey: 'Am' },
  { name: 'Lo-Fi Hip Hop Sample Pack', slug: 'lofi-hiphop-sample-pack', type: 'sample-pack', categorySlug: 'sample-pack', price: 0, isFree: true, downloadCount: 3456, bpm: 85, musicalKey: 'Cm' },
  { name: 'Trap Melody Loops Pack', slug: 'trap-melody-loops', type: 'sample-pack', categorySlug: 'sample-pack', price: 149000, downloadCount: 892, bpm: 140, musicalKey: 'Dm' },
  { name: 'EDM Future Bass Samples', slug: 'edm-future-bass-samples', type: 'sample-pack', categorySlug: 'sample-pack', price: 249000, originalPrice: 349000, downloadCount: 567, featured: true, bpm: 150 },
  { name: 'Vocal Chop Collection', slug: 'vocal-chop-collection', type: 'sample-pack', categorySlug: 'sample-pack', price: 99000, downloadCount: 2100, bpm: 128 },

  // Instruments
  { name: 'Piano Collection Premium', slug: 'piano-collection-premium', type: 'instrument', categorySlug: 'instrument', price: 399000, originalPrice: 599000, downloadCount: 670, featured: true },
  { name: 'Guitar Acoustic Pack', slug: 'guitar-acoustic-pack', type: 'instrument', categorySlug: 'instrument', price: 0, isFree: true, downloadCount: 4200 },
  { name: 'Violin & Strings Bundle', slug: 'violin-strings-bundle', type: 'instrument', categorySlug: 'instrument', price: 299000, downloadCount: 340 },
]

async function getToken(): Promise<string> {
  const res = await fetch(`${API}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const data = await res.json()
  if (!data.token) throw new Error('Login failed: ' + JSON.stringify(data))
  return data.token
}

async function seed() {
  console.log('🔑 Logging in as admin...')
  const token = await getToken()
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `JWT ${token}`,
  }

  // 1. Create categories
  console.log('\n📂 Creating categories...')
  const catMap: Record<string, number> = {}

  for (const cat of categories) {
    // Check if exists
    const check = await fetch(`${API}/categories?where[slug][equals]=${cat.slug}&limit=1`, { headers })
    const existing = await check.json()
    if (existing.docs?.length > 0) {
      catMap[cat.slug] = existing.docs[0].id
      console.log(`  ✓ ${cat.name} (already exists, id=${existing.docs[0].id})`)
      continue
    }

    const res = await fetch(`${API}/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        order: cat.order,
      }),
    })
    const data = await res.json()
    if (data.doc?.id) {
      catMap[cat.slug] = data.doc.id
      console.log(`  ✓ ${cat.name} (created, id=${data.doc.id})`)
    } else {
      console.log(`  ✗ ${cat.name} — ${JSON.stringify(data.errors || data.message || 'unknown error')}`)
    }
  }

  // 2. Create placeholder media for thumbnails
  console.log('\n🖼️  Creating placeholder thumbnail...')
  let thumbnailId: number | null = null
  const mediaCheck = await fetch(`${API}/media?where[filename][equals]=placeholder.jpg&limit=1`, { headers })
  const mediaExisting = await mediaCheck.json()
  if (mediaExisting.docs?.length > 0) {
    thumbnailId = mediaExisting.docs[0].id
    console.log(`  ✓ Placeholder already exists (id=${thumbnailId})`)
  } else {
    // Create media via form data
    const form = new FormData()
    // Create a minimal JPEG buffer
    const blob = new Blob([new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
    ])], { type: 'image/jpeg' })
    form.append('file', blob, 'placeholder.jpg')
    form.append('alt', 'Product placeholder')

    const res = await fetch(`${API}/media`, {
      method: 'POST',
      headers: { 'Authorization': `JWT ${token}` },
      body: form,
    })
    const data = await res.json()
    if (data.doc?.id) {
      thumbnailId = data.doc.id
      console.log(`  ✓ Placeholder created (id=${thumbnailId})`)
    } else {
      console.log(`  ✗ Failed to create placeholder — ${JSON.stringify(data.errors || data.message)}`)
    }
  }

  // 3. Create products
  console.log('\n📦 Creating products...')
  let created = 0, skipped = 0

  for (const p of products) {
    // Check if exists
    const check = await fetch(`${API}/products?where[slug][equals]=${p.slug}&limit=1`, { headers })
    const existing = await check.json()
    if (existing.docs?.length > 0) {
      skipped++
      continue
    }

    const categoryId = catMap[p.categorySlug]
    if (!categoryId) {
      console.log(`  ✗ ${p.name} — category "${p.categorySlug}" not found`)
      continue
    }

    const body: Record<string, unknown> = {
      name: p.name,
      slug: p.slug,
      type: p.type,
      category: categoryId,
      pricing: {
        price: p.price,
        originalPrice: p.originalPrice || null,
        isFree: p.isFree || p.price === 0,
      },
      downloadCount: p.downloadCount,
      featured: p.featured || false,
      _status: 'published',
    }

    if (thumbnailId) body.thumbnail = thumbnailId

    if (p.bpm || p.musicalKey) {
      body.preview = { bpm: p.bpm || null, musicalKey: p.musicalKey || null }
    }

    const res = await fetch(`${API}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.doc?.id) {
      created++
      console.log(`  ✓ ${p.name}`)
    } else {
      console.log(`  ✗ ${p.name} — ${JSON.stringify(data.errors?.[0]?.message || data.message || 'error')}`)
    }
  }

  console.log(`\n✅ Done! Created ${created} products, skipped ${skipped} (already exist)`)
  console.log(`   Categories: ${Object.keys(catMap).length}`)
  console.log(`   Total products in DB: ${created + skipped}`)
}

seed().catch(console.error)
