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

/** Upload an image (data URL) to Payload media collection.
 *  Returns the media document ID on success, or null on failure. */
export async function uploadMedia(dataUrl: string, slugName?: string): Promise<number | null> {
  try {
    const { blob, mimeType } = dataUrlToBlob(dataUrl)
    const ext = mimeToExt(mimeType)
    const name = slugName
      ? `${slugName.replace(/\.[^.]+$/, '')}-${Date.now()}.${ext}`
      : `product-${Date.now()}.${ext}`


    const formData = new FormData()
    formData.append('file', blob, name)
    formData.append('alt', slugName?.replace(/\.[^.]+$/, '') || 'Product image')

    const uploadRes = await fetch(`${API}/media`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    const responseText = await uploadRes.text()
    let data: Record<string, unknown>
    try {
      data = JSON.parse(responseText)
    } catch {
      console.error('[uploadMedia] Invalid response:', responseText.slice(0, 200))
      return null
    }

    if (!uploadRes.ok) {
      console.error('[uploadMedia] Failed:', uploadRes.status, data)
      return null
    }

    const doc = (data.doc as Record<string, unknown>) || data
    const id = doc.id
    return id ? Number(id) : null
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

  const res = await fetch(`${API}/products?${params}`, { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

export async function createProduct(data: Record<string, unknown>) {
  const res = await fetch(`${API}/products`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ ...data, _status: 'published' }),
  })
  if (!res.ok) {
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { message: `HTTP ${res.status}: ${text.slice(0, 200)}` } }
  }
  return res.json()
}

export async function updateProduct(id: string | number, data: Record<string, unknown>) {
  const res = await fetch(`${API}/products/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ ...data, _status: 'published' }),
  })
  if (!res.ok) {
    const text = await res.text()
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
  const res = await fetch(`${API}/categories?limit=100&sort=order&depth=0`, { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

/** Revalidate customer-facing pages after admin edits */
export async function revalidateProductPages() {
  try {
    const res = await fetch('/api/revalidate', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      console.error('[revalidate] Failed:', res.status, data)
    }
    return data
  } catch (e) {
    console.error('[revalidate] Network error:', e)
    return null
  }
}
