/**
 * Multi-Stem Instrument Separator — Advanced DSP
 *
 * Separates an instrumental track into 6 stems:
 *   Drums, Bass, Guitar, Piano, Strings, Others
 *
 * Techniques:
 *   1. HPSS (Harmonic-Percussive Source Separation) for drums isolation
 *   2. Sub-band frequency isolation for bass
 *   3. Onset detection + spectral analysis for guitar/piano/strings
 *   4. Soft masking with energy conservation
 */

export interface MultiStemProgress {
  phase: 'analyze' | 'separate' | 'reconstruct'
  percent: number
  detail?: string
}

export interface StemPair {
  left: Float32Array
  right: Float32Array
}

export interface MultiStemResult {
  drums: StemPair
  bass: StemPair
  guitar: StemPair
  piano: StemPair
  strings: StemPair
  others: StemPair
}

// ── Constants ─────────────────────────────────────────────────

const FFT_SIZE = 4096
const HOP = 1024
const BINS = (FFT_SIZE >> 1) + 1
const EPS = 1e-10
const HPSS_KERNEL = 17

// ── Radix-2 FFT (Float32, in-place) ──────────────────────────

function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = real[i]; real[i] = real[j]; real[j] = t
      t = imag[i]; imag[i] = imag[j]; imag[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wR = Math.cos(ang), wI = Math.sin(ang)
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

function ifft(real: Float32Array, imag: Float32Array): void {
  const n = real.length
  for (let i = 0; i < n; i++) imag[i] = -imag[i]
  fft(real, imag)
  for (let i = 0; i < n; i++) { real[i] /= n; imag[i] = -imag[i] / n }
}

// ── Hann window ───────────────────────────────────────────────

function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size)
  for (let i = 0; i < size; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size))
  return w
}

// ── Median filter (1D, small kernel) ──────────────────────────

function median1D(arr: Float32Array, start: number, stride: number, len: number, kernel: number): Float32Array {
  const half = (kernel - 1) >> 1
  const result = new Float32Array(len)
  const buf: number[] = new Array(kernel)
  for (let i = 0; i < len; i++) {
    const lo = Math.max(0, i - half)
    const hi = Math.min(len - 1, i + half)
    let bLen = 0
    for (let j = lo; j <= hi; j++) buf[bLen++] = arr[start + j * stride]
    // Insertion sort (fast for small K=17)
    for (let a = 1; a < bLen; a++) {
      const v = buf[a]
      let b = a - 1
      while (b >= 0 && buf[b] > v) { buf[b + 1] = buf[b]; b-- }
      buf[b + 1] = v
    }
    result[i] = buf[bLen >> 1]
  }
  return result
}

// ── Smooth step for mask transitions ──────────────────────────

function smoothStep(x: number, edge0: number, edge1: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 + EPS)))
  return t * t * (3 - 2 * t)
}

// ── Frequency weight (bell curve) ─────────────────────────────

function bellWeight(freq: number, center: number, width: number): number {
  const x = (freq - center) / width
  return Math.exp(-0.5 * x * x)
}

// ── Main: Separate instruments from instrumental track ────────

export async function separateInstruments(
  instL: Float32Array,
  instR: Float32Array,
  sampleRate: number,
  onProgress?: (p: MultiStemProgress) => void,
): Promise<MultiStemResult> {
  const length = instL.length
  const numFrames = Math.ceil((length - FFT_SIZE) / HOP) + 1
  const win = hannWindow(FFT_SIZE)

  // ── Pass 1: Forward STFT → magnitude spectrogram for analysis ──
  onProgress?.({ phase: 'analyze', percent: 0, detail: 'Phân tích phổ tần...' })

  // Store mono magnitude for HPSS analysis: mag[frame * BINS + bin]
  const mag = new Float32Array(numFrames * BINS)
  // Store onset strength per frame
  const onsetStrength = new Float32Array(numFrames)

  const rL = new Float32Array(FFT_SIZE), iL = new Float32Array(FFT_SIZE)
  const rR = new Float32Array(FFT_SIZE), iR = new Float32Array(FFT_SIZE)
  let prevMag: Float32Array | null = null

  for (let f = 0; f < numFrames; f++) {
    const off = f * HOP
    rL.fill(0); iL.fill(0); rR.fill(0); iR.fill(0)
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = off + i
      if (idx < length) {
        rL[i] = instL[idx] * win[i]
        rR[i] = instR[idx] * win[i]
      }
    }
    fft(rL, iL); fft(rR, iR)

    const base = f * BINS
    let flux = 0
    for (let k = 0; k < BINS; k++) {
      // Mono magnitude = avg of L and R magnitudes
      const mL = Math.sqrt(rL[k] * rL[k] + iL[k] * iL[k])
      const mR = Math.sqrt(rR[k] * rR[k] + iR[k] * iR[k])
      const m = (mL + mR) * 0.5
      mag[base + k] = m

      // Spectral flux (onset detection)
      if (prevMag) {
        const diff = m - prevMag[k]
        if (diff > 0) flux += diff
      }
    }
    onsetStrength[f] = flux
    prevMag = mag.subarray(base, base + BINS)

    if (f % 100 === 0) {
      onProgress?.({ phase: 'analyze', percent: Math.round((f / numFrames) * 30), detail: 'STFT phân tích...' })
      await new Promise(r => setTimeout(r, 0))
    }
  }

  // Normalize onset strength to [0, 1]
  let maxOnset = 0
  for (let f = 0; f < numFrames; f++) if (onsetStrength[f] > maxOnset) maxOnset = onsetStrength[f]
  if (maxOnset > 0) for (let f = 0; f < numFrames; f++) onsetStrength[f] /= maxOnset

  // ── HPSS: Median filtering for harmonic/percussive separation ──
  onProgress?.({ phase: 'analyze', percent: 30, detail: 'HPSS tách nhạc cụ...' })

  // Compute drumsRatio directly: only store harmonic median temporarily per-bin,
  // then compute percussive median per-frame and derive ratio in-place.
  // This avoids holding 3 large arrays simultaneously.

  // Step 1: Compute time-axis median (harmonic) into drumsRatio temporarily
  const drumsRatio = new Float32Array(numFrames * BINS)

  for (let k = 0; k < BINS; k++) {
    const filtered = median1D(mag, k, BINS, numFrames, HPSS_KERNEL)
    for (let f = 0; f < numFrames; f++) drumsRatio[f * BINS + k] = filtered[f] // harmonic

    if (k % 200 === 0) {
      onProgress?.({ phase: 'analyze', percent: 30 + Math.round((k / BINS) * 15), detail: 'HPSS harmonic...' })
      await new Promise(r => setTimeout(r, 0))
    }
  }

  // Step 2: Compute freq-axis median (percussive) per frame, then compute ratio in-place
  for (let f = 0; f < numFrames; f++) {
    const base = f * BINS
    const percFiltered = median1D(mag, base, 1, BINS, HPSS_KERNEL)
    for (let k = 0; k < BINS; k++) {
      const h = drumsRatio[base + k] // currently holds harmonic magnitude
      const p = percFiltered[k]
      const h2 = h * h, p2 = p * p
      drumsRatio[base + k] = p2 / (h2 + p2 + EPS) // now holds drums ratio
    }
  }

  onProgress?.({ phase: 'analyze', percent: 50, detail: 'Tính toán mask...' })

  onProgress?.({ phase: 'separate', percent: 55, detail: 'Chuẩn bị tách stems...' })

  // ── Pass 2: Reconstruction — STFT → apply masks → ISTFT per stem ──

  // Output accumulators
  const out = {
    drums: { left: new Float32Array(length), right: new Float32Array(length) },
    bass: { left: new Float32Array(length), right: new Float32Array(length) },
    guitar: { left: new Float32Array(length), right: new Float32Array(length) },
    piano: { left: new Float32Array(length), right: new Float32Array(length) },
    strings: { left: new Float32Array(length), right: new Float32Array(length) },
    others: { left: new Float32Array(length), right: new Float32Array(length) },
  }
  const winSum = new Float32Array(length)

  // Scratch arrays for IFFT (reused per stem per channel)
  const scrR = new Float32Array(FFT_SIZE)
  const scrI = new Float32Array(FFT_SIZE)

  // Pre-allocate per-stem STFT accumulators (reused each frame to avoid GC pressure)
  const stemRL: Float32Array[] = Array.from({ length: 6 }, () => new Float32Array(FFT_SIZE))
  const stemIL: Float32Array[] = Array.from({ length: 6 }, () => new Float32Array(FFT_SIZE))
  const stemRR: Float32Array[] = Array.from({ length: 6 }, () => new Float32Array(FFT_SIZE))
  const stemIR: Float32Array[] = Array.from({ length: 6 }, () => new Float32Array(FFT_SIZE))

  for (let f = 0; f < numFrames; f++) {
    const off = f * HOP
    const base = f * BINS
    const onset = onsetStrength[f]

    // Forward STFT for L and R
    rL.fill(0); iL.fill(0); rR.fill(0); iR.fill(0)
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = off + i
      if (idx < length) {
        rL[i] = instL[idx] * win[i]
        rR[i] = instR[idx] * win[i]
      }
    }
    fft(rL, iL); fft(rR, iR)

    // Clear stem accumulators for this frame
    for (let s = 0; s < 6; s++) {
      stemRL[s].fill(0); stemIL[s].fill(0)
      stemRR[s].fill(0); stemIR[s].fill(0)
    }

    for (let k = 0; k < BINS; k++) {
      const freq = (k * sampleRate) / FFT_SIZE
      const dr = drumsRatio[base + k]

      // ── Drums mask: percussive component from HPSS ──
      let mDrums = dr * dr // sharpen
      mDrums = mDrums > 0.55 ? mDrums : mDrums * 0.4 // gate weak drums

      // ── Bass mask: low frequencies from harmonic content ──
      let mBass = 0
      const harmonicPart = 1 - mDrums
      if (freq < 100) mBass = harmonicPart * 1.0
      else if (freq < 280) mBass = harmonicPart * (1.0 - smoothStep(freq, 100, 280))
      else mBass = 0

      // ── Remaining harmonic content for mid/high instruments ──
      const remaining = Math.max(0, harmonicPart - mBass)

      // ── Piano: sharp attack + wide freq range (27-4200Hz) ──
      // Piano has very distinct percussive hammer attack + resonant decay
      const pianoFreqW = bellWeight(freq, 800, 2000)
      const pianoOnsetW = smoothStep(onset, 0.4, 0.8) // needs strong onset (hammer hit)
      let mPiano = remaining * pianoFreqW * pianoOnsetW * 0.8

      // ── Guitar: moderate attack, lower mid-range (80-5000Hz) ──
      // Guitar has pluck attack (moderate onset) centered lower than piano
      const guitarFreqW = bellWeight(freq, 500, 1200)
      const guitarOnsetW = smoothStep(onset, 0.15, 0.5) * (1 - smoothStep(onset, 0.7, 0.95))
      let mGuitar = remaining * guitarFreqW * guitarOnsetW * 0.75

      // ── Strings: sustained, smooth attack, rich harmonics (200-10000Hz) ──
      // Strings are bowed instruments: very smooth onset, long sustain
      const stringsFreqW = bellWeight(freq, 1500, 2500)
      const stringsOnsetW = 1.0 - smoothStep(onset, 0.15, 0.4) // sustained = low onset
      let mStrings = remaining * stringsFreqW * stringsOnsetW * 0.75

      // ── Normalize so masks don't exceed remaining ──
      const midTotal = mPiano + mGuitar + mStrings
      if (midTotal > remaining && midTotal > EPS) {
        const scale = remaining / midTotal
        mPiano *= scale
        mGuitar *= scale
        mStrings *= scale
      }

      // ── Others: residual ──
      let mOthers = Math.max(0, 1 - mDrums - mBass - mPiano - mGuitar - mStrings)

      // Ensure total = 1
      const total = mDrums + mBass + mPiano + mGuitar + mStrings + mOthers
      if (total > EPS) {
        const norm = 1.0 / total
        mDrums *= norm; mBass *= norm; mPiano *= norm
        mGuitar *= norm; mStrings *= norm; mOthers *= norm
      }

      const masks = [mDrums, mBass, mGuitar, mPiano, mStrings, mOthers]

      // Apply masks to L and R STFT
      for (let s = 0; s < 6; s++) {
        stemRL[s][k] = rL[k] * masks[s]
        stemIL[s][k] = iL[k] * masks[s]
        stemRR[s][k] = rR[k] * masks[s]
        stemIR[s][k] = iR[k] * masks[s]

        // Conjugate symmetry
        if (k > 0 && k < BINS - 1) {
          const mk = FFT_SIZE - k
          stemRL[s][mk] = stemRL[s][k]; stemIL[s][mk] = -stemIL[s][k]
          stemRR[s][mk] = stemRR[s][k]; stemIR[s][mk] = -stemIR[s][k]
        }
      }
    }

    // IFFT each stem and overlap-add
    const stemKeys = ['drums', 'bass', 'guitar', 'piano', 'strings', 'others'] as const
    for (let s = 0; s < 6; s++) {
      // Left channel
      scrR.set(stemRL[s]); scrI.set(stemIL[s])
      ifft(scrR, scrI)
      for (let i = 0; i < FFT_SIZE; i++) {
        const idx = off + i
        if (idx < length) out[stemKeys[s]].left[idx] += scrR[i] * win[i]
      }

      // Right channel
      scrR.set(stemRR[s]); scrI.set(stemIR[s])
      ifft(scrR, scrI)
      for (let i = 0; i < FFT_SIZE; i++) {
        const idx = off + i
        if (idx < length) out[stemKeys[s]].right[idx] += scrR[i] * win[i]
      }
    }

    // Window sum (only need once, same for all stems)
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = off + i
      if (idx < length) winSum[idx] += win[i] * win[i]
    }

    if (f % 50 === 0) {
      onProgress?.({
        phase: 'reconstruct',
        percent: 55 + Math.round((f / numFrames) * 40),
        detail: `Tái tạo ${f + 1}/${numFrames}...`,
      })
      await new Promise(r => setTimeout(r, 0))
    }
  }

  // ── Normalize overlap-add + soft clip ──────────────────────────
  onProgress?.({ phase: 'reconstruct', percent: 95, detail: 'Chuẩn hóa...' })

  const stemKeys = ['drums', 'bass', 'guitar', 'piano', 'strings', 'others'] as const
  for (let i = 0; i < length; i++) {
    const norm = winSum[i] > EPS ? 1.0 / winSum[i] : 0
    for (const key of stemKeys) {
      out[key].left[i] = Math.max(-1, Math.min(1, out[key].left[i] * norm))
      out[key].right[i] = Math.max(-1, Math.min(1, out[key].right[i] * norm))
    }
  }

  onProgress?.({ phase: 'reconstruct', percent: 100, detail: 'Hoàn tất!' })
  return out
}
