#!/usr/bin/env node
// Copy onnxruntime-web runtime files from node_modules to public/ort
// so the browser loads them from the same origin (no CDN dependency).
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'onnxruntime-web', 'dist')
const dst = join(root, 'public', 'ort')

if (!existsSync(src)) {
  console.error('[sync-ort] source not found:', src)
  process.exit(0) // don't fail install if ORT missing
}
mkdirSync(dst, { recursive: true })

// Files needed by ort.all.min.js at runtime (WASM + WebGPU + proxy worker)
const patterns = [
  /^ort\.all\.min\.js$/,
  /^ort\.wasm\.min\.js$/,
  /^ort-wasm-simd-threaded\.(jsep|asyncify)?\.?mjs$/,
  /^ort-wasm-simd-threaded\.(jsep|asyncify)?\.?wasm$/,
]

let copied = 0
for (const f of readdirSync(src)) {
  if (!patterns.some((p) => p.test(f))) continue
  const s = join(src, f)
  if (!statSync(s).isFile()) continue
  copyFileSync(s, join(dst, f))
  copied++
}
console.log(`[sync-ort] copied ${copied} files -> public/ort`)
