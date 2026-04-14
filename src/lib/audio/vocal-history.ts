/**
 * Vocal separation history — IndexedDB-backed, survives F5.
 *
 * Stores the last N completed jobs so users can reload their previous
 * separations without re-paying. Stems are quantized to Int16 on disk
 * (half the size of Float32) then expanded back on load. A typical
 * 4-minute 7-stem job ≈ 300 MB on disk; we keep only the 3 most recent.
 */

import type { JobMode, JobResult } from './vocal-job'

const DB_NAME = 'vocal-history'
const DB_VERSION = 1
const META_STORE = 'meta'
const DATA_STORE = 'data'
const MAX_ENTRIES = 3

export interface HistoryMeta {
  id: string
  fileName: string
  fileSize: number
  mode: JobMode
  sampleRate: number
  createdAt: number
  stemNames: string[]
  durationSec: number
}

export interface HistoryRecord extends HistoryMeta {
  stems: Record<string, { left: Float32Array; right: Float32Array }>
}

// ── Int16 quantization (halves on-disk footprint) ──────────────

function floatToInt16(buf: Float32Array): Int16Array {
  const n = buf.length
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

function int16ToFloat(buf: Int16Array): Float32Array {
  const n = buf.length
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = buf[i] / 0x8000
  return out
}

// ── DB open ────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── Public API ─────────────────────────────────────────────────

const STEM_KEYS = ['vocals', 'instrumental', 'drums', 'bass', 'guitar', 'piano', 'strings', 'others'] as const

export async function saveJob(
  result: JobResult,
  fileName: string,
  fileSize: number,
): Promise<string | null> {
  try {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const stems: Record<string, { left: Int16Array; right: Int16Array }> = {}
    for (const k of STEM_KEYS) {
      const s = result[k]
      if (s && typeof s === 'object' && 'left' in s) {
        stems[k] = { left: floatToInt16(s.left), right: floatToInt16(s.right) }
      }
    }
    const stemNames = Object.keys(stems)
    if (stemNames.length === 0) return null
    const sampleCount = stems[stemNames[0]].left.length
    const meta: HistoryMeta = {
      id,
      fileName,
      fileSize,
      mode: result.mode,
      sampleRate: result.sampleRate,
      createdAt: Date.now(),
      stemNames,
      durationSec: sampleCount / result.sampleRate,
    }

    const db = await openDB()
    await pruneOldest(db, MAX_ENTRIES - 1)

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(META_STORE).put(meta)
      tx.objectStore(DATA_STORE).put(stems, id)
    })
    return id
  } catch (err) {
    console.warn('[vocal-history] saveJob failed:', err)
    return null
  }
}

async function pruneOldest(db: IDBDatabase, keepCount: number): Promise<void> {
  const metas = await new Promise<HistoryMeta[]>((resolve) => {
    const tx = db.transaction(META_STORE, 'readonly')
    const req = tx.objectStore(META_STORE).getAll()
    req.onsuccess = () => resolve((req.result as HistoryMeta[]) || [])
    req.onerror = () => resolve([])
  })
  metas.sort((a, b) => b.createdAt - a.createdAt)
  const toDelete = metas.slice(keepCount)
  if (toDelete.length === 0) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    for (const m of toDelete) {
      tx.objectStore(META_STORE).delete(m.id)
      tx.objectStore(DATA_STORE).delete(m.id)
    }
  })
}

export async function listJobs(): Promise<HistoryMeta[]> {
  try {
    const db = await openDB()
    return await new Promise<HistoryMeta[]>((resolve) => {
      const tx = db.transaction(META_STORE, 'readonly')
      const req = tx.objectStore(META_STORE).getAll()
      req.onsuccess = () => {
        const list = (req.result as HistoryMeta[]) || []
        list.sort((a, b) => b.createdAt - a.createdAt)
        resolve(list)
      }
      req.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

export async function loadJob(id: string): Promise<HistoryRecord | null> {
  try {
    const db = await openDB()
    const meta = await new Promise<HistoryMeta | null>((resolve) => {
      const tx = db.transaction(META_STORE, 'readonly')
      const req = tx.objectStore(META_STORE).get(id)
      req.onsuccess = () => resolve((req.result as HistoryMeta) || null)
      req.onerror = () => resolve(null)
    })
    if (!meta) return null

    const raw = await new Promise<Record<string, { left: Int16Array; right: Int16Array }> | null>(
      (resolve) => {
        const tx = db.transaction(DATA_STORE, 'readonly')
        const req = tx.objectStore(DATA_STORE).get(id)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => resolve(null)
      },
    )
    if (!raw) return null

    const stems: Record<string, { left: Float32Array; right: Float32Array }> = {}
    for (const k of Object.keys(raw)) {
      stems[k] = { left: int16ToFloat(raw[k].left), right: int16ToFloat(raw[k].right) }
    }
    return { ...meta, stems }
  } catch (err) {
    console.warn('[vocal-history] loadJob failed:', err)
    return null
  }
}

export async function deleteJob(id: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.objectStore(META_STORE).delete(id)
      tx.objectStore(DATA_STORE).delete(id)
    })
  } catch {
    /* noop */
  }
}
