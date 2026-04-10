'use client'

/**
 * Client-side Payload API helpers.
 * Used by admin pages to sync edits to the database.
 * Auth is handled via Payload's payload-token cookie (credentials: 'include').
 */

const API = '/api'
const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Check if user has a valid Payload session (not demo mode) */
export async function checkPayloadAuth(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/users/me`, { credentials: 'include' })
    if (!res.ok) return false
    const data = await res.json()
    return !!data.user
  } catch {
    return false
  }
}


/** Convert data URL to Blob (reliable cross-browser method) */
function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const [header, base64Data] = dataUrl.split(',')
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const byteString = atob(base64Data)
  const bytes = new Uint8Array(byteString.length)
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i)
  }
  return { blob: new Blob([bytes], { type: mimeType }), mimeType }
}

/** Get file extension from MIME type */
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
  }
  return map[mime] || 'jpg'
}

/** Upload an image (data URL) to R2 via /api/upload/thumbnail.
 *  Returns the R2 public URL on success, or null on failure.
 *  Also tries Payload /api/media as fallback to get a media ID. */
export async function uploadMedia(dataUrl: string, slugName?: string): Promise<number | string | null> {
  try {
    const { blob, mimeType } = dataUrlToBlob(dataUrl)
    const ext = mimeToExt(mimeType)
    const name = slugName
      ? `${slugName.replace(/\.[^.]+$/, '')}-${Date.now()}.${ext}`
      : `product-${Date.now()}.${ext}`

    // Upload via /api/upload/thumbnail (handles R2 or Vercel Blob)
    const formData = new FormData()
    formData.append('file', blob, name)
    formData.append('productSlug', slugName || 'product')

    const res = await fetch('/api/upload/thumbnail', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    if (res.ok) {
      const data = await res.json()
      if (data.url) return data.url as string
    }

    const errData = await res.json().catch(() => ({}))
    console.error('[uploadMedia] Upload failed:', res.status, errData)
    return null
  } catch (e) {
    console.error('[uploadMedia] Error:', e)
    return null
  }
}

export async function fetchProducts(opts?: { limit?: number; type?: string; category?: string }) {
  const params = new URLSearchParams()
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.type) params.set('where[type][equals]', opts.type)
  if (opts?.category) params.set('where[category.slug][equals]', opts.category)
  params.set('depth', '2')
  params.set('sort', '-createdAt')

  // Add timeout to handle Neon cold starts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)
  try {
    const res = await fetch(`${API}/products?${params}`, {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[fetchProducts] HTTP', res.status, text.slice(0, 300))
      return { docs: [], totalDocs: 0, error: `HTTP ${res.status}` }
    }
    return res.json()
  } catch (e) {
    clearTimeout(timer)
    console.error('[fetchProducts] Error:', e)
    return { docs: [], totalDocs: 0, error: String(e) }
  }
}

export async function createProduct(data: Record<string, unknown>) {
  const res = await fetch(`${API}/products`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[createProduct] HTTP', res.status, text.slice(0, 300))
    try { return JSON.parse(text) } catch { return { message: `HTTP ${res.status}: ${text.slice(0, 200)}` } }
  }
  return res.json()
}

export async function updateProduct(id: string | number, data: Record<string, unknown>) {
  const res = await fetch(`${API}/products/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[updateProduct] HTTP', res.status, text.slice(0, 300))
    try { return JSON.parse(text) } catch { return { message: `HTTP ${res.status}: ${text.slice(0, 200)}` } }
  }
  return res.json()
}

export async function deleteProduct(id: string | number) {
  const res = await fetch(`${API}/products/${id}`, {
    method: 'DELETE',
    headers: JSON_HEADERS,
    credentials: 'include',
  })
  if (!res.ok) {
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { message: `HTTP ${res.status}: ${text.slice(0, 200)}` } }
  }
  return res.json()
}

export async function fetchCategories() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)
  try {
    const res = await fetch(`${API}/categories?limit=100&sort=order&depth=0`, {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      console.error('[fetchCategories] HTTP', res.status)
      return null
    }
    return res.json()
  } catch (e) {
    clearTimeout(timer)
    console.error('[fetchCategories] Error:', e)
    return null
  }
}

/** Revalidate customer-facing pages after admin edits */
export async function revalidateProductPages() {
  // Try up to 2 times — first attempt may fail on Neon cold start
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      const res = await fetch('/api/revalidate', {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (res.ok) return data
      console.error('[revalidate] Failed:', res.status, data)
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      return data
    } catch (e) {
      console.error(`[revalidate] Attempt ${attempt} error:`, e)
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      return null
    }
  }
  return null
}
