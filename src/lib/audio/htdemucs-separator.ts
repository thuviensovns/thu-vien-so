/**
 * HTDemucs — Hybrid Transformer Demucs waveform separator.
 *
 * Architecture differs fundamentally from MDX-Net:
 *   - Input:  raw waveform [1, 2, T]  (stereo, T ≈ 343980 samples / ~7.8s)
 *   - Output: [1, 4, 2, T] — 4 stems (drums, bass, other, vocals) directly
 *
 * Pipeline: pad → normalize per-channel (subtract mean, divide by std) →
 *           overlapping segments → model → un-normalize → Hann fade crossfade → stitch
 *
 * Gated by NEXT_PUBLIC_AI_HTDEMUCS_URL — if no URL is configured the
 * separator throws a descriptive error so the UI can surface a helpful message.
 */

import { getModel } from './ai-models'
import { downloadModel } from './ai-separator'

export interface HtDemucsProgress {
  phase: 'download' | 'load' | 'inference' | 'reconstruct'
  percent: number
  detail?: string
}

export interface HtDemucsResult {
  drums: { left: Float32Array; right: Float32Array }
  bass: { left: Float32Array; right: Float32Array }
  other: { left: Float32Array; right: Float32Array }
  vocals: { left: Float32Array; right: Float32Array }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadOrt(): Promise<any> {
  // Reuse the ORT already injected by ai-separator (it caches the global).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any
  if (g.ort) return g.ort
  // Fallback: dynamic import of the separator forces it to load ORT.
  await import('./ai-separator')
  if (!g.ort) {
    // Trigger the loader by attempting a minimal op — ai-separator only loads
    // ORT lazily inside separateWithAI. So we load it directly here.
    await injectOrt()
  }
  return g.ort
}

function injectOrt(): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = '/ort/ort.all.min.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('ort inject failed'))
    document.head.appendChild(s)
  })
}

/** Compute mean and std across a Float32Array (for per-channel normalization). */
function meanStd(arr: Float32Array): { mean: number; std: number } {
  const n = arr.length
  if (n === 0) return { mean: 0, std: 1 }
  let sum = 0
  for (let i = 0; i < n; i++) sum += arr[i]
  const mean = sum / n
  let sq = 0
  for (let i = 0; i < n; i++) {
    const d = arr[i] - mean
    sq += d * d
  }
  const std = Math.sqrt(sq / n) || 1e-8
  return { mean, std }
}

/** Hann fade-in/fade-out window for overlap-add crossfade. */
function buildFadeWindow(size: number, fadeLen: number): Float32Array {
  const w = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    if (i < fadeLen) {
      w[i] = 0.5 * (1 - Math.cos((Math.PI * i) / fadeLen))
    } else if (i >= size - fadeLen) {
      const j = size - 1 - i
      w[i] = 0.5 * (1 - Math.cos((Math.PI * j) / fadeLen))
    } else {
      w[i] = 1
    }
  }
  return w
}

export async function separateWithHTDemucs(
  left: Float32Array,
  right: Float32Array,
  _sampleRate: number,
  onProgress?: (p: HtDemucsProgress) => void,
): Promise<HtDemucsResult> {
  const model = getModel('htdemucs')
  if (model.spec.architecture !== 'htdemucs') {
    throw new Error('htdemucs model spec malformed')
  }
  if (!model.upstreamUrl) {
    throw new Error(
      'HTDemucs chưa được cấu hình — thiết lập NEXT_PUBLIC_AI_HTDEMUCS_URL rồi rebuild.',
    )
  }

  const spec = model.spec
  const length = left.length
  const seg = spec.segmentSamples
  const hop = Math.floor(seg * (1 - spec.overlap))
  const fadeLen = seg - hop

  // ── Download model ───────────────────────────────────────────
  onProgress?.({ phase: 'download', percent: 0, detail: `Tải ${model.label}...` })
  const modelBuffer = await downloadModel(model.url, model.cacheKey, (pct) => {
    onProgress?.({ phase: 'download', percent: pct, detail: `Tải HTDemucs... ${pct}%` })
  })

  // ── Load ORT ─────────────────────────────────────────────────
  onProgress?.({ phase: 'load', percent: 0, detail: 'Khởi tạo runtime...' })
  const ort = await loadOrt()
  ort.env.wasm.wasmPaths = '/ort/'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _self = (typeof self !== 'undefined' ? self : globalThis) as any
  const hasWebGPU = typeof navigator !== 'undefined' && !!_self.navigator?.gpu
  const hasSAB = typeof SharedArrayBuffer !== 'undefined'
  const coi = _self.crossOriginIsolated === true

  const configs: Array<{ name: string; ep: string[]; threads: number; proxy: boolean }> = []
  if (hasWebGPU) configs.push({ name: 'webgpu', ep: ['webgpu'], threads: 1, proxy: false })
  if (hasSAB && coi) configs.push({ name: 'wasm-mt', ep: ['wasm'], threads: Math.min(navigator.hardwareConcurrency || 4, 4), proxy: true })
  configs.push({ name: 'wasm-st', ep: ['wasm'], threads: 1, proxy: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any = null
  let lastErr: unknown = null
  for (const cfg of configs) {
    try {
      ort.env.wasm.numThreads = cfg.threads
      ort.env.wasm.proxy = cfg.proxy
      session = await ort.InferenceSession.create(modelBuffer, { executionProviders: cfg.ep })
      break
    } catch (e) {
      lastErr = e
    }
  }
  if (!session) {
    throw new Error(`HTDemucs backend init failed: ${lastErr instanceof Error ? lastErr.message : lastErr}`)
  }
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]

  // ── Normalize per-channel (HTDemucs expects ~unit variance) ─
  const { mean: mL, std: sL } = meanStd(left)
  const { mean: mR, std: sR } = meanStd(right)
  const normL = new Float32Array(length)
  const normR = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    normL[i] = (left[i] - mL) / sL
    normR[i] = (right[i] - mR) / sR
  }

  // ── Overlap-add segmentation ─────────────────────────────────
  const out = {
    drums:  { left: new Float32Array(length), right: new Float32Array(length) },
    bass:   { left: new Float32Array(length), right: new Float32Array(length) },
    other:  { left: new Float32Array(length), right: new Float32Array(length) },
    vocals: { left: new Float32Array(length), right: new Float32Array(length) },
  } satisfies HtDemucsResult
  const weight = new Float32Array(length)
  const win = buildFadeWindow(seg, fadeLen)

  const numSegs = Math.max(1, Math.ceil((length - fadeLen) / hop))
  for (let segIdx = 0; segIdx < numSegs; segIdx++) {
    const start = segIdx * hop
    const end = Math.min(start + seg, length)
    const segLen = end - start

    // Build input [1, 2, seg] — pad with zeros beyond audio end
    const inputData = new Float32Array(2 * seg)
    for (let i = 0; i < segLen; i++) {
      inputData[i] = normL[start + i]
      inputData[seg + i] = normR[start + i]
    }

    onProgress?.({
      phase: 'inference',
      percent: Math.round((segIdx / numSegs) * 100),
      detail: `HTDemucs segment ${segIdx + 1}/${numSegs}`,
    })

    const tensor = new ort.Tensor('float32', inputData, [1, 2, seg])
    const results = await session.run({ [inputName]: tensor })
    const outData = results[outputName].data as Float32Array
    // Expected shape [1, 4, 2, seg] — stems order: drums, bass, other, vocals
    const stemStride = 2 * seg

    const stems: Array<keyof HtDemucsResult> = [
      spec.outputStems[0] as keyof HtDemucsResult,
      spec.outputStems[1] as keyof HtDemucsResult,
      spec.outputStems[2] as keyof HtDemucsResult,
      spec.outputStems[3] as keyof HtDemucsResult,
    ]
    for (let s = 0; s < 4; s++) {
      const dst = out[stems[s]]
      const base = s * stemStride
      for (let i = 0; i < segLen; i++) {
        const w = win[i]
        dst.left[start + i] += outData[base + i] * w
        dst.right[start + i] += outData[base + seg + i] * w
      }
    }
    // Accumulate weight once (all stems share the same window)
    for (let i = 0; i < segLen; i++) weight[start + i] += win[i]

    await new Promise((r) => setTimeout(r, 0))
  }

  // ── Divide by weight, un-normalize, clamp ───────────────────
  onProgress?.({ phase: 'reconstruct', percent: 100, detail: 'Kết hợp segment...' })
  const stemKeys: Array<keyof HtDemucsResult> = ['drums', 'bass', 'other', 'vocals']
  for (const k of stemKeys) {
    const pair = out[k]
    for (let i = 0; i < length; i++) {
      const w = weight[i] || 1
      pair.left[i] = Math.max(-1, Math.min(1, (pair.left[i] / w) * sL + mL))
      pair.right[i] = Math.max(-1, Math.min(1, (pair.right[i] / w) * sR + mR))
    }
  }

  session.release()
  return out
}
