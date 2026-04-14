/**
 * AI Vocal Separator — ONNX Runtime Web + MDX-Net
 *
 * Uses pre-trained MDX-Net ONNX models (same as Ultimate Vocal Remover)
 * running entirely in the browser via ONNX Runtime WebAssembly backend.
 *
 * Pipeline: Audio → STFT → Model Inference → ISTFT → Separated Audio
 */

// ── Types ──────────────────────────────────────────────────────

export interface AIProgress {
  phase: 'download' | 'load' | 'stft' | 'inference' | 'reconstruct' | 'stems'
  percent: number
  detail?: string
}

export interface AISeparationResult {
  vocalsL: Float32Array
  vocalsR: Float32Array
  instL: Float32Array
  instR: Float32Array
}

// ── ONNX Runtime loader (same-origin first, CDN fallback) ─────
// Files served from /public/ort/ via scripts/sync-ort.mjs (runs on install + build).

const ORT_LOCAL_BASE = '/ort/'
const ORT_CDN_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'

let ortBaseUsed = ORT_LOCAL_BASE

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`script load failed: ${src}`))
    document.head.appendChild(s)
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadOrtFromCDN(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any
  if (g.ort) return g.ort

  const sources: Array<[string, string]> = [
    [`${ORT_LOCAL_BASE}ort.all.min.js`, ORT_LOCAL_BASE],
    [`${ORT_CDN_BASE}ort.all.min.js`, ORT_CDN_BASE],
  ]
  let lastErr: unknown = null
  for (const [url, base] of sources) {
    try {
      await injectScript(url)
      if (g.ort) {
        ortBaseUsed = base
        return g.ort
      }
      lastErr = new Error('ort global not set after script load')
    } catch (e) {
      lastErr = e
      console.warn('[AI-Sep] ORT load failed from', url, e)
    }
  }
  throw new Error(
    `Failed to load ONNX Runtime (local + CDN): ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  )
}

function getOrtBase(): string {
  return ortBaseUsed
}

// ── Model config ───────────────────────────────────────────────

const MODEL_URL =
  'https://huggingface.co/seanghay/uvr_models/resolve/main/kuielab_a_vocals.onnx'
const MODEL_CACHE_DB = 'vocal-separator-cache'
const MODEL_CACHE_STORE = 'models'
const MODEL_CACHE_KEY = 'kuielab_a_vocals_v1'

// MDX-Net parameters for kuielab_a_vocals
const N_FFT = 6144
const HOP = 1024
const DIM_F = 2048 // frequency bins model expects (cropped from N_FFT/2+1)
const DIM_T = 512 // time frames per segment (kuielab_a_vocals model expects 512)
const DIM_C = 4 // channels: L_real, L_imag, R_real, R_imag (CAC format)
const COMPENSATE = 1.035
const CHUNK_SIZE = (DIM_T - 1) * HOP // 261120 samples per chunk (~5.9s @44.1kHz)
const N_BINS = N_FFT / 2 + 1 // 3073

// ── Radix-2 FFT (in-place, power-of-2 sizes) ──────────────────

function fftRadix2(real: Float32Array, imag: Float32Array): void {
  const n = real.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let tmp = real[i]; real[i] = real[j]; real[j] = tmp
      tmp = imag[i]; imag[i] = imag[j]; imag[j] = tmp
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wR = Math.cos(angle)
    const wI = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let cR = 1, cI = 0
      const half = len >> 1
      for (let j = 0; j < half; j++) {
        const a = i + j, b = a + half
        const uR = real[a], uI = imag[a]
        const vR = real[b] * cR - imag[b] * cI
        const vI = real[b] * cI + imag[b] * cR
        real[a] = uR + vR; imag[a] = uI + vI
        real[b] = uR - vR; imag[b] = uI - vI
        const t = cR * wR - cI * wI
        cI = cR * wI + cI * wR; cR = t
      }
    }
  }
}

function ifftRadix2(real: Float32Array, imag: Float32Array): void {
  const n = real.length
  for (let i = 0; i < n; i++) imag[i] = -imag[i]
  fftRadix2(real, imag)
  for (let i = 0; i < n; i++) { real[i] /= n; imag[i] = -imag[i] / n }
}

// ── Mixed-radix FFT for N=6144 (= 2048 × 3) ──────────────────
// ~8x faster than Bluestein: 3 radix-2 FFTs of size 2048 + DFT-3 butterflies

const N1 = 2048 // radix-2 part
const N2 = 3    // radix-3 part
const TWO_PI = 2 * Math.PI

// Pre-computed twiddle factors for N_FFT=6144
let _twR: Float32Array | null = null
let _twI: Float32Array | null = null

function initTwiddles(): void {
  if (_twR) return
  _twR = new Float32Array(N1 * N2)
  _twI = new Float32Array(N1 * N2)
  for (let k1 = 0; k1 < N1; k1++) {
    for (let n2 = 0; n2 < N2; n2++) {
      const angle = -TWO_PI * k1 * n2 / N_FFT
      _twR[k1 * N2 + n2] = Math.cos(angle)
      _twI[k1 * N2 + n2] = Math.sin(angle)
    }
  }
}

// DFT-3 butterfly: compute 3-point DFT in-place
const W3R = Math.cos(TWO_PI / 3) // -0.5
const W3I = -Math.sin(TWO_PI / 3) // -√3/2

function fft6144(
  inR: Float32Array, inI: Float32Array,
  outR: Float32Array, outI: Float32Array,
): void {
  initTwiddles()
  const twR = _twR!, twI = _twI!

  // Step 1: Decompose into 3 subsequences of length 2048
  // x_n2[n1] = x[n1 * 3 + n2] for n2 = 0, 1, 2
  const sub0R = new Float32Array(N1), sub0I = new Float32Array(N1)
  const sub1R = new Float32Array(N1), sub1I = new Float32Array(N1)
  const sub2R = new Float32Array(N1), sub2I = new Float32Array(N1)

  for (let n1 = 0; n1 < N1; n1++) {
    sub0R[n1] = inR[n1 * 3];     sub0I[n1] = inI[n1 * 3]
    sub1R[n1] = inR[n1 * 3 + 1]; sub1I[n1] = inI[n1 * 3 + 1]
    sub2R[n1] = inR[n1 * 3 + 2]; sub2I[n1] = inI[n1 * 3 + 2]
  }

  // Step 2: FFT each subsequence (radix-2, size 2048)
  fftRadix2(sub0R, sub0I)
  fftRadix2(sub1R, sub1I)
  fftRadix2(sub2R, sub2I)

  // Step 3: Multiply by twiddle factors and apply DFT-3 butterfly
  for (let k1 = 0; k1 < N1; k1++) {
    // Apply twiddle: Y_n2[k1] = sub_n2[k1] * W^(k1*n2)
    const s0r = sub0R[k1], s0i = sub0I[k1]
    // Twiddle for n2=1
    const tw1r = twR[k1 * 3 + 1], tw1i = twI[k1 * 3 + 1]
    const s1r = sub1R[k1] * tw1r - sub1I[k1] * tw1i
    const s1i = sub1R[k1] * tw1i + sub1I[k1] * tw1r
    // Twiddle for n2=2
    const tw2r = twR[k1 * 3 + 2], tw2i = twI[k1 * 3 + 2]
    const s2r = sub2R[k1] * tw2r - sub2I[k1] * tw2i
    const s2i = sub2R[k1] * tw2i + sub2I[k1] * tw2r

    // DFT-3 butterfly: X[k2*N1 + k1] for k2 = 0, 1, 2
    // k2=0: sum
    outR[k1] = s0r + s1r + s2r
    outI[k1] = s0i + s1i + s2i
    // k2=1: s0 + W3^1*s1 + W3^2*s2
    const t1r = s1r * W3R - s1i * W3I
    const t1i = s1r * W3I + s1i * W3R
    const t2r = s2r * (W3R * W3R - W3I * W3I) - s2i * (2 * W3R * W3I)
    const t2i = s2r * (2 * W3R * W3I) + s2i * (W3R * W3R - W3I * W3I)
    outR[N1 + k1] = s0r + t1r + t2r
    outI[N1 + k1] = s0i + t1i + t2i
    // k2=2: s0 + W3^2*s1 + W3^4*s2 = s0 + W3^2*s1 + W3^1*s2
    const u1r = s1r * (W3R * W3R - W3I * W3I) - s1i * (2 * W3R * W3I)
    const u1i = s1r * (2 * W3R * W3I) + s1i * (W3R * W3R - W3I * W3I)
    const u2r = s2r * W3R - s2i * W3I
    const u2i = s2r * W3I + s2i * W3R
    outR[2 * N1 + k1] = s0r + u1r + u2r
    outI[2 * N1 + k1] = s0i + u1i + u2i
  }
}

function ifft6144(
  inR: Float32Array, inI: Float32Array,
  outR: Float32Array, outI: Float32Array,
): void {
  // IFFT = conj(FFT(conj(x))) / N
  const conjR = new Float32Array(N_FFT)
  const conjI = new Float32Array(N_FFT)
  for (let i = 0; i < N_FFT; i++) { conjR[i] = inR[i]; conjI[i] = -inI[i] }
  fft6144(conjR, conjI, outR, outI)
  for (let i = 0; i < N_FFT; i++) { outR[i] /= N_FFT; outI[i] = -outI[i] / N_FFT }
}

// ── Hann window ────────────────────────────────────────────────

function hanningWindow(size: number): Float32Array {
  const w = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size))
  }
  return w
}

// ── STFT / ISTFT (center=true, matching torch.stft) ────────────

/**
 * Compute STFT for a mono chunk with center padding.
 * Returns [N_BINS, numFrames] real and imag arrays.
 */
function stftChunk(
  signal: Float32Array,
  win: Float32Array,
): { real: Float32Array; imag: Float32Array; numFrames: number } {
  // Center padding: pad N_FFT//2 on each side
  const pad = N_FFT >> 1
  const padded = new Float32Array(signal.length + N_FFT)
  padded.set(signal, pad)

  const numFrames = Math.floor(signal.length / HOP) + 1
  const real = new Float32Array(N_BINS * numFrames)
  const imag = new Float32Array(N_BINS * numFrames)

  const frameR = new Float32Array(N_FFT)
  const frameI = new Float32Array(N_FFT)
  const outR = new Float32Array(N_FFT)
  const outI = new Float32Array(N_FFT)

  for (let f = 0; f < numFrames; f++) {
    const offset = f * HOP
    frameI.fill(0)
    for (let i = 0; i < N_FFT; i++) {
      frameR[i] = (offset + i < padded.length ? padded[offset + i] : 0) * win[i]
    }

    fft6144(frameR, frameI, outR, outI)

    const base = f * N_BINS
    for (let k = 0; k < N_BINS; k++) {
      real[base + k] = outR[k]
      imag[base + k] = outI[k]
    }
  }

  return { real, imag, numFrames }
}

/**
 * Inverse STFT for a mono chunk via overlap-add with center trim.
 */
function istftChunk(
  real: Float32Array,
  imag: Float32Array,
  numFrames: number,
  originalLength: number,
  win: Float32Array,
): Float32Array {
  const pad = N_FFT >> 1
  const totalLen = originalLength + N_FFT
  const output = new Float32Array(totalLen)
  const windowSum = new Float32Array(totalLen)

  const fullR = new Float32Array(N_FFT)
  const fullI = new Float32Array(N_FFT)
  const outR = new Float32Array(N_FFT)
  const outI = new Float32Array(N_FFT)

  for (let f = 0; f < numFrames; f++) {
    const base = f * N_BINS
    fullR.fill(0)
    fullI.fill(0)

    for (let k = 0; k < N_BINS; k++) {
      fullR[k] = real[base + k]
      fullI[k] = imag[base + k]
    }
    for (let k = 1; k < N_BINS - 1; k++) {
      fullR[N_FFT - k] = fullR[k]
      fullI[N_FFT - k] = -fullI[k]
    }

    ifft6144(fullR, fullI, outR, outI)

    const offset = f * HOP
    for (let i = 0; i < N_FFT; i++) {
      const idx = offset + i
      if (idx < totalLen) {
        const w = win[i]
        output[idx] += outR[i] * w
        windowSum[idx] += w * w
      }
    }
  }

  // Normalize and trim center padding
  const result = new Float32Array(originalLength)
  for (let i = 0; i < originalLength; i++) {
    const j = i + pad
    result[i] = windowSum[j] > 1e-10 ? output[j] / windowSum[j] : 0
  }
  return result
}

// ── IndexedDB model cache ──────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MODEL_CACHE_DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(MODEL_CACHE_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getCachedModel(): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(MODEL_CACHE_STORE, 'readonly')
      const req = tx.objectStore(MODEL_CACHE_STORE).get(MODEL_CACHE_KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function cacheModel(data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(MODEL_CACHE_STORE, 'readwrite')
    tx.objectStore(MODEL_CACHE_STORE).put(data, MODEL_CACHE_KEY)
  } catch {
    // Cache failure is non-critical
  }
}

// ── Model download ─────────────────────────────────────────────

async function downloadModel(
  onProgress?: (pct: number) => void,
): Promise<ArrayBuffer> {
  // Try cache first
  const cached = await getCachedModel()
  if (cached) {
    onProgress?.(100)
    return cached
  }

  // Download with progress
  const response = await fetch(MODEL_URL)
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`)

  const contentLength = Number(response.headers.get('content-length') || 0)
  const reader = response.body!.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (contentLength > 0) {
      onProgress?.(Math.round((received / contentLength) * 100))
    }
  }

  // Merge chunks
  const buffer = new ArrayBuffer(received)
  const view = new Uint8Array(buffer)
  let offset = 0
  for (const chunk of chunks) {
    view.set(chunk, offset)
    offset += chunk.length
  }

  // Cache for next time
  await cacheModel(buffer)
  return buffer
}

// ── Check if model is cached ───────────────────────────────────

export async function isModelCached(): Promise<boolean> {
  return (await getCachedModel()) !== null
}

// ── Main AI separation ─────────────────────────────────────────

export async function separateWithAI(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  onProgress?: (p: AIProgress) => void,
): Promise<AISeparationResult> {
  const length = left.length

  // ── Step 1: Download model ───────────────────────────────────
  onProgress?.({ phase: 'download', percent: 0, detail: 'Kiểm tra model AI...' })
  const modelBuffer = await downloadModel((pct) => {
    onProgress?.({
      phase: 'download',
      percent: pct,
      detail: pct < 100 ? `Tải model AI... ${pct}%` : 'Model đã sẵn sàng',
    })
  })

  // ── Step 2: Load ONNX session ────────────────────────────────
  onProgress?.({ phase: 'load', percent: 0, detail: 'Khởi tạo ONNX Runtime...' })
  const ort = await loadOrtFromCDN()

  ort.env.wasm.wasmPaths = getOrtBase()

  // Off-main-thread inference — moves ORT session into its own Web Worker
  // so STFT/ISTFT + React UI on the main thread stay smooth (no tab freeze).
  ort.env.wasm.proxy = true

  // Detect WebGPU support to use the fastest available backend first.
  const hasWebGPU =
    typeof navigator !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(navigator as any).gpu

  let session: InstanceType<typeof ort.InferenceSession>
  try {
    ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 4)
    const eps = hasWebGPU ? ['webgpu', 'wasm'] : ['wasm']
    session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: eps,
    })
    console.log('[AI-Sep] ONNX loaded (proxy=true) EPs:', eps, 'threads:', ort.env.wasm.numThreads)
  } catch (mtErr) {
    console.warn('[AI-Sep] Preferred EPs failed, falling back to single-thread wasm:', mtErr)
    ort.env.wasm.numThreads = 1
    session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
    })
    console.log('[AI-Sep] ONNX loaded with 1 thread (fallback)')
  }

  // Debug: log model input/output info
  const inNames = session.inputNames
  const outNames = session.outputNames
  console.log('[AI-Sep] Model inputs:', inNames, 'outputs:', outNames)

  // Try to detect expected shape by probing with a small tensor
  let detectedDimT = DIM_T
  let detectedDimF = DIM_F
  let detectedDimC = DIM_C
  try {
    // Try the expected shape first
    const probe = new Float32Array(DIM_C * DIM_F * DIM_T)
    const probeTensor = new ort.Tensor('float32', probe, [1, DIM_C, DIM_F, DIM_T])
    const probeResult = await session.run({ [inNames[0]]: probeTensor })
    const outShape = probeResult[outNames[0]].dims
    console.log('[AI-Sep] Probe OK. Output shape:', outShape)
  } catch (probeErr: unknown) {
    const msg = probeErr instanceof Error ? probeErr.message : String(probeErr)
    console.warn('[AI-Sep] Probe [1,' + DIM_C + ',' + DIM_F + ',' + DIM_T + '] failed, trying alternatives...', msg)

    // Try alternative shapes to find what works
    const shapes = [
      [1, 2, DIM_F, DIM_T],
      [1, DIM_C, DIM_F, DIM_T / 2],
      [1, DIM_C, DIM_F, DIM_T * 2],
      [1, DIM_C, DIM_T, DIM_F],
    ]
    for (const shape of shapes) {
      try {
        const sz = shape.reduce((a, b) => a * b, 1)
        const t = new ort.Tensor('float32', new Float32Array(sz), shape)
        await session.run({ [inNames[0]]: t })
        detectedDimC = shape[1]
        detectedDimF = shape[2]
        detectedDimT = shape[3]
        console.log('[AI-Sep] Found working shape:', shape)
        break
      } catch {
        console.log('[AI-Sep] Shape', shape, 'also failed')
      }
    }

    if (detectedDimT !== DIM_T || detectedDimF !== DIM_F || detectedDimC !== DIM_C) {
      console.log('[AI-Sep] Using detected dims: C=' + detectedDimC + ' F=' + detectedDimF + ' T=' + detectedDimT)
    }
  }

  onProgress?.({ phase: 'load', percent: 100, detail: 'ONNX Runtime sẵn sàng' })

  // ── Step 3: Process in chunks (matching UVR pipeline) ─────────
  // Split audio into chunks → STFT each chunk → model → ISTFT → overlap-add
  onProgress?.({ phase: 'stft', percent: 0, detail: 'Chuẩn bị xử lý...' })

  const win = hanningWindow(N_FFT)
  const inputName = inNames[0]
  const outputName = outNames[0]

  // Use detected dimensions (may differ from defaults if model has different shape)
  const useDimC = detectedDimC
  const useDimF = detectedDimF
  const useDimT = detectedDimT
  const useChunkSize = (useDimT - 1) * HOP

  // Pad audio to multiple of chunk size
  const numChunks = Math.ceil(length / useChunkSize)
  const paddedLen = numChunks * useChunkSize
  const padL = new Float32Array(paddedLen)
  const padR = new Float32Array(paddedLen)
  padL.set(left)
  padR.set(right)

  // Output accumulators
  const vocalsL = new Float32Array(paddedLen)
  const vocalsR = new Float32Array(paddedLen)

  for (let c = 0; c < numChunks; c++) {
    const chunkStart = c * useChunkSize
    const chunkL = padL.subarray(chunkStart, chunkStart + useChunkSize)
    const chunkR = padR.subarray(chunkStart, chunkStart + useChunkSize)

    // STFT each channel (center=true)
    onProgress?.({
      phase: 'stft',
      percent: Math.round((c / numChunks) * 100),
      detail: `STFT chunk ${c + 1}/${numChunks}...`,
    })
    const sL = stftChunk(chunkL, win)
    const sR = stftChunk(chunkR, win)
    await new Promise((r) => setTimeout(r, 0))

    // Build input tensor [1, useDimC, useDimF, useDimT]
    // CAC format: ch0=L_real, ch1=L_imag, ch2=R_real, ch3=R_imag
    const plane = useDimF * useDimT
    const inputData = new Float32Array(useDimC * plane)

    const framesToUse = Math.min(sL.numFrames, useDimT)
    for (let t = 0; t < framesToUse; t++) {
      const srcBase = t * N_BINS
      for (let f = 0; f < useDimF; f++) {
        const srcIdx = srcBase + f
        const dstIdx = f * useDimT + t
        inputData[0 * plane + dstIdx] = sL.real[srcIdx] // L_real
        inputData[1 * plane + dstIdx] = sL.imag[srcIdx] // L_imag
        if (useDimC >= 4) {
          inputData[2 * plane + dstIdx] = sR.real[srcIdx] // R_real
          inputData[3 * plane + dstIdx] = sR.imag[srcIdx] // R_imag
        }
      }
    }

    // Run inference
    onProgress?.({
      phase: 'inference',
      percent: Math.round((c / numChunks) * 100),
      detail: `AI segment ${c + 1}/${numChunks}...`,
    })
    const inputTensor = new ort.Tensor('float32', inputData, [1, useDimC, useDimF, useDimT])
    const results = await session.run({ [inputName]: inputTensor })
    const out = results[outputName].data as Float32Array

    // Extract output → separated STFT, pad back to N_BINS
    const vocSpecLR = new Float32Array(N_BINS * useDimT)
    const vocSpecLI = new Float32Array(N_BINS * useDimT)
    const vocSpecRR = new Float32Array(N_BINS * useDimT)
    const vocSpecRI = new Float32Array(N_BINS * useDimT)

    for (let t = 0; t < framesToUse; t++) {
      const dstBase = t * N_BINS
      for (let f = 0; f < useDimF; f++) {
        const srcIdx = f * useDimT + t
        vocSpecLR[dstBase + f] = out[0 * plane + srcIdx]
        vocSpecLI[dstBase + f] = out[1 * plane + srcIdx]
        if (useDimC >= 4) {
          vocSpecRR[dstBase + f] = out[2 * plane + srcIdx]
          vocSpecRI[dstBase + f] = out[3 * plane + srcIdx]
        }
      }
    }

    // ISTFT back to waveform
    onProgress?.({
      phase: 'reconstruct',
      percent: Math.round((c / numChunks) * 100),
      detail: `Tái tạo chunk ${c + 1}/${numChunks}...`,
    })
    const wavL = istftChunk(vocSpecLR, vocSpecLI, useDimT, useChunkSize, win)
    const wavR = istftChunk(vocSpecRR, vocSpecRI, useDimT, useChunkSize, win)

    // Accumulate
    for (let i = 0; i < useChunkSize; i++) {
      vocalsL[chunkStart + i] = wavL[i] * COMPENSATE
      vocalsR[chunkStart + i] = wavR[i] * COMPENSATE
    }

    await new Promise((r) => setTimeout(r, 0))
  }

  // Trim to original length
  const finalVocL = vocalsL.subarray(0, length)
  const finalVocR = vocalsR.subarray(0, length)

  // Instrumental = original - vocals (residual approach)
  const instL = new Float32Array(length)
  const instR = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    instL[i] = Math.max(-1, Math.min(1, left[i] - finalVocL[i]))
    instR[i] = Math.max(-1, Math.min(1, right[i] - finalVocR[i]))
    finalVocL[i] = Math.max(-1, Math.min(1, finalVocL[i]))
    finalVocR[i] = Math.max(-1, Math.min(1, finalVocR[i]))
  }

  onProgress?.({ phase: 'reconstruct', percent: 100, detail: 'Hoàn tất!' })
  session.release()

  return { vocalsL: finalVocL, vocalsR: finalVocR, instL, instR }
}

// ── Multi-stem AI separation (7 tracks) ────────────────────────

import { separateInstruments, type MultiStemResult, type StemPair } from './multi-stem-separator'

export interface MultiStemAIResult {
  vocals: StemPair
  drums: StemPair
  bass: StemPair
  guitar: StemPair
  piano: StemPair
  strings: StemPair
  others: StemPair
}

export interface FourStemAIResult {
  vocals: StemPair
  drums: StemPair
  bass: StemPair
  others: StemPair
}

export async function separateMultiStemWithAI(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  onProgress?: (p: AIProgress) => void,
): Promise<MultiStemAIResult> {
  // Phase 1: AI vocal separation (0-70%)
  const aiResult = await separateWithAI(left, right, sampleRate, (p) => {
    onProgress?.({
      ...p,
      percent: Math.round(p.percent * 0.7),
      detail: p.detail,
    })
  })

  // Phase 2: DSP instrument separation on instrumental track (70-100%)
  onProgress?.({ phase: 'stems', percent: 70, detail: 'Tách nhạc cụ...' })

  const stemResult: MultiStemResult = await separateInstruments(
    aiResult.instL,
    aiResult.instR,
    sampleRate,
    (p) => {
      onProgress?.({
        phase: 'stems',
        percent: 70 + Math.round(p.percent * 0.3),
        detail: p.detail,
      })
    },
  )

  return {
    vocals: { left: aiResult.vocalsL, right: aiResult.vocalsR },
    ...stemResult,
  }
}

// ── 4-stem AI separation (Vocals, Drums, Bass, Others) ────────

export async function separate4StemWithAI(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  onProgress?: (p: AIProgress) => void,
): Promise<FourStemAIResult> {
  // Phase 1: AI vocal separation (0-70%)
  const aiResult = await separateWithAI(left, right, sampleRate, (p) => {
    onProgress?.({
      ...p,
      percent: Math.round(p.percent * 0.7),
      detail: p.detail,
    })
  })

  // Phase 2: DSP instrument separation on instrumental track (70-100%)
  onProgress?.({ phase: 'stems', percent: 70, detail: 'Tách nhạc cụ...' })

  const stemResult: MultiStemResult = await separateInstruments(
    aiResult.instL,
    aiResult.instR,
    sampleRate,
    (p) => {
      onProgress?.({
        phase: 'stems',
        percent: 70 + Math.round(p.percent * 0.3),
        detail: p.detail,
      })
    },
  )

  // Merge guitar + piano + strings + others into a single "others" track
  const len = stemResult.others.left.length
  const othersL = new Float32Array(len)
  const othersR = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    othersL[i] = stemResult.guitar.left[i] + stemResult.piano.left[i] +
                 stemResult.strings.left[i] + stemResult.others.left[i]
    othersR[i] = stemResult.guitar.right[i] + stemResult.piano.right[i] +
                 stemResult.strings.right[i] + stemResult.others.right[i]
  }

  return {
    vocals: { left: aiResult.vocalsL, right: aiResult.vocalsR },
    drums: stemResult.drums,
    bass: stemResult.bass,
    others: { left: othersL, right: othersR },
  }
}
