/**
 * BS-RoFormer — raw-waveform I/O adapter.
 *
 * Most common RoFormer ONNX exports (community conversions of the ZFTurbo
 * / lucidrains checkpoints) expose a waveform-in / waveform-out signature:
 *
 *   Input:  [1, 2, T]  stereo float32 waveform
 *   Output: [1, 2, T]  stereo float32 vocals
 *
 * Band-split + rotary-PE transformer are implementation details baked into
 * the graph. The browser only needs to feed chunks of the right length and
 * stitch the output.
 *
 * Pipeline: per-channel normalize → overlapping segments → model → Hann
 *           crossfade → un-normalize. Same structure as HTDemucs adapter.
 *
 * Instrumental is derived as residual = mix − vocals to keep phase coherent.
 */

import { getModel, getOverriddenUpstreamUrl, resolveClientModelUrl } from './ai-models'
import { downloadModel } from './ai-separator'
import { equalizeStems } from './loudness'

export interface RoFormerProgress {
  phase: 'download' | 'load' | 'stft' | 'inference' | 'reconstruct'
  percent: number
  detail?: string
}

export interface RoFormerResult {
  vocalsL: Float32Array
  vocalsR: Float32Array
  instL: Float32Array
  instR: Float32Array
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadOrt(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any
  if (g.ort) return g.ort
  await import('./ai-separator') // forces ORT global via its CDN/local loader
  if (!g.ort) throw new Error('ORT unavailable')
  return g.ort
}

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
  return { mean, std: Math.sqrt(sq / n) || 1e-8 }
}

function buildFadeWindow(size: number, fadeLen: number): Float32Array {
  const w = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    if (i < fadeLen) w[i] = 0.5 * (1 - Math.cos((Math.PI * i) / fadeLen))
    else if (i >= size - fadeLen) {
      const j = size - 1 - i
      w[i] = 0.5 * (1 - Math.cos((Math.PI * j) / fadeLen))
    } else w[i] = 1
  }
  return w
}

/** Default segment length: 11.88s @ 44.1kHz — ZFTurbo BS-RoFormer typical. */
const DEFAULT_SEGMENT = 524288
const OVERLAP = 0.25

export async function separateWithRoFormer(
  left: Float32Array,
  right: Float32Array,
  _sampleRate: number,
  onProgress?: (p: RoFormerProgress) => void,
): Promise<RoFormerResult> {
  const model = getModel('roformer')
  const upstream = getOverriddenUpstreamUrl('roformer') || model.upstreamUrl
  if (!upstream) {
    throw new Error(
      'RoFormer chưa được cấu hình — set NEXT_PUBLIC_AI_ROFORMER_URL hoặc ' +
        'dán URL trong Settings (admin). Xem docs/ai-separation-research.md.',
    )
  }

  const length = left.length

  // ── Download + ORT ───────────────────────────────────────────
  onProgress?.({ phase: 'download', percent: 0, detail: 'Tải RoFormer...' })
  const buf = await downloadModel(resolveClientModelUrl('roformer'), model.cacheKey, (pct) => {
    onProgress?.({ phase: 'download', percent: pct, detail: `Tải RoFormer... ${pct}%` })
  })

  onProgress?.({ phase: 'load', percent: 0, detail: 'Khởi tạo runtime...' })
  const ort = await loadOrt()
  ort.env.wasm.wasmPaths = '/ort/'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _self = (typeof self !== 'undefined' ? self : globalThis) as any
  const hasWebGPU = typeof navigator !== 'undefined' && !!_self.navigator?.gpu
  const hasSAB = typeof SharedArrayBuffer !== 'undefined'
  const coi = _self.crossOriginIsolated === true

  const configs: Array<{ ep: string[]; threads: number; proxy: boolean }> = []
  if (hasWebGPU) configs.push({ ep: ['webgpu'], threads: 1, proxy: false })
  if (hasSAB && coi) configs.push({ ep: ['wasm'], threads: Math.min(navigator.hardwareConcurrency || 4, 4), proxy: true })
  configs.push({ ep: ['wasm'], threads: 1, proxy: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any = null
  let lastErr: unknown = null
  for (const cfg of configs) {
    try {
      ort.env.wasm.numThreads = cfg.threads
      ort.env.wasm.proxy = cfg.proxy
      session = await ort.InferenceSession.create(buf, { executionProviders: cfg.ep })
      break
    } catch (e) {
      lastErr = e
    }
  }
  if (!session) {
    throw new Error(
      `RoFormer backend init failed: ${lastErr instanceof Error ? lastErr.message : lastErr}. ` +
        `Kiểm tra model ONNX có I/O [1,2,T] waveform không.`,
    )
  }

  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]

  // Probe input shape — if the model has a fixed time dim, use it.
  let seg = DEFAULT_SEGMENT
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = session.inputMetadata?.[inputName] as any
    if (meta?.dimensions && meta.dimensions.length === 3) {
      const t = Number(meta.dimensions[2])
      if (Number.isFinite(t) && t > 0) seg = t
    }
  } catch { /* fall through */ }

  const hop = Math.max(1, Math.floor(seg * (1 - OVERLAP)))
  const fadeLen = seg - hop
  const win = buildFadeWindow(seg, fadeLen)

  // ── Per-channel normalize ───────────────────────────────────
  const { mean: mL, std: sL } = meanStd(left)
  const { mean: mR, std: sR } = meanStd(right)
  const normL = new Float32Array(length)
  const normR = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    normL[i] = (left[i] - mL) / sL
    normR[i] = (right[i] - mR) / sR
  }

  const vocL = new Float32Array(length)
  const vocR = new Float32Array(length)
  const weight = new Float32Array(length)

  const numSegs = Math.max(1, Math.ceil((length - fadeLen) / hop))
  for (let segIdx = 0; segIdx < numSegs; segIdx++) {
    const start = segIdx * hop
    const end = Math.min(start + seg, length)
    const segLen = end - start

    const inputData = new Float32Array(2 * seg)
    for (let i = 0; i < segLen; i++) {
      inputData[i] = normL[start + i]
      inputData[seg + i] = normR[start + i]
    }

    onProgress?.({
      phase: 'inference',
      percent: Math.round((segIdx / numSegs) * 100),
      detail: `RoFormer segment ${segIdx + 1}/${numSegs}`,
    })

    const tensor = new ort.Tensor('float32', inputData, [1, 2, seg])
    const results = await session.run({ [inputName]: tensor })
    const out = results[outputName].data as Float32Array

    // Expected [1, 2, seg] vocals. If shape differs (e.g. [1, N_stems, 2, seg])
    // take the first 2*seg as L/R of the primary stem.
    if (out.length < 2 * seg) {
      throw new Error(
        `RoFormer output too small (${out.length} < ${2 * seg}) — model I/O không khớp.`,
      )
    }

    for (let i = 0; i < segLen; i++) {
      const w = win[i]
      vocL[start + i] += out[i] * w
      vocR[start + i] += out[seg + i] * w
      weight[start + i] += w
    }

    await new Promise((r) => setTimeout(r, 0))
  }

  // ── Un-normalize vocals, derive instrumental as residual ─────
  onProgress?.({ phase: 'reconstruct', percent: 100, detail: 'Kết hợp segment...' })
  const instL = new Float32Array(length)
  const instR = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const w = weight[i] || 1
    const vL = Math.max(-1, Math.min(1, (vocL[i] / w) * sL + mL))
    const vR = Math.max(-1, Math.min(1, (vocR[i] / w) * sR + mR))
    vocL[i] = vL
    vocR[i] = vR
    instL[i] = Math.max(-1, Math.min(1, left[i] - vL))
    instR[i] = Math.max(-1, Math.min(1, right[i] - vR))
  }

  equalizeStems(
    { vocals: { left: vocL, right: vocR }, inst: { left: instL, right: instR } },
    { left, right },
  )

  session.release()
  return { vocalsL: vocL, vocalsR: vocR, instL, instR }
}
