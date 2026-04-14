/**
 * Professional Vocal Separator — STFT Spectral Analysis
 *
 * Techniques (inspired by BandLab Splitter / UVR / Demucs DSP pipeline):
 * 1. STFT with periodic Hann window (COLA-compliant, 75% overlap)
 * 2. Harmonic-Percussive Source Separation (HPSS) via median filtering
 * 3. Multi-cue stereo analysis: correlation + phase coherence + magnitude balance
 * 4. Power masking (α=2.5) for sharper separation boundaries
 * 5. Spectral gating — threshold-based cleanup of quiet bleed
 * 6. Multi-pass Wiener filtering with frequency-band-specific parameters
 * 7. Vocal bandpass (80Hz–12kHz) + sub-bass preservation for instrumental
 * 8. Energy-conserving residual redistribution
 */

// ── FFT (Cooley-Tukey Radix-2, in-place) ──────────────────────

function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[real[i], real[j]] = [real[j], real[i]]
      ;[imag[i], imag[j]] = [imag[j], imag[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wR = Math.cos(angle)
    const wI = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let cR = 1,
        cI = 0
      const half = len >> 1
      for (let j = 0; j < half; j++) {
        const idx1 = i + j
        const idx2 = idx1 + half
        const uR = real[idx1]
        const uI = imag[idx1]
        const vR = real[idx2] * cR - imag[idx2] * cI
        const vI = real[idx2] * cI + imag[idx2] * cR
        real[idx1] = uR + vR
        imag[idx1] = uI + vI
        real[idx2] = uR - vR
        imag[idx2] = uI - vI
        const tmpR = cR * wR - cI * wI
        cI = cR * wI + cI * wR
        cR = tmpR
      }
    }
  }
}

function ifft(real: Float64Array, imag: Float64Array): void {
  const n = real.length
  for (let i = 0; i < n; i++) imag[i] = -imag[i]
  fft(real, imag)
  for (let i = 0; i < n; i++) {
    real[i] /= n
    imag[i] = -imag[i] / n
  }
}

// ── Window ─────────────────────────────────────────────────────

function hanningWindow(size: number): Float64Array {
  const w = new Float64Array(size)
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size))
  }
  return w
}

// ── Parameters ─────────────────────────────────────────────────

const FFT_SIZE = 4096
const HOP_SIZE = 1024
const BINS = (FFT_SIZE >> 1) + 1
const EPS = 1e-10
const POWER_ALPHA = 2.5 // mask exponent — higher = sharper separation
const GATE_LO = 0.12 // below this → force to 0 (remove bleed)
const GATE_HI = 0.88 // above this → force to 1 (preserve fully)
const WIENER_PASSES = 4
const HPSS_KERNEL = 17 // median filter kernel size for HPSS
const TEMPORAL_SMOOTH = 0.25

// ── Frequency band system ──────────────────────────────────────

interface BandParams {
  vocalWeight: number // how likely this band contains vocals
  gateStrength: number // how aggressively to gate (0=soft, 1=hard)
  powerAlpha: number // mask sharpening exponent
}

function getBandParams(freq: number): BandParams {
  // Sub-bass (0-80Hz): almost never vocals
  if (freq < 80) return { vocalWeight: 0.02, gateStrength: 0.95, powerAlpha: 3.0 }
  // Bass (80-250Hz): vocal fundamental starts here
  if (freq < 250) return { vocalWeight: 0.35, gateStrength: 0.6, powerAlpha: 2.5 }
  // Low-mid (250-500Hz): vocal body
  if (freq < 500) return { vocalWeight: 0.75, gateStrength: 0.4, powerAlpha: 2.0 }
  // Mid (500-2kHz): core vocal presence
  if (freq < 2000) return { vocalWeight: 1.0, gateStrength: 0.3, powerAlpha: 2.0 }
  // Upper-mid (2k-4kHz): vocal clarity & presence
  if (freq < 4000) return { vocalWeight: 0.95, gateStrength: 0.35, powerAlpha: 2.2 }
  // Presence (4k-8kHz): vocal harmonics + sibilance
  if (freq < 8000) return { vocalWeight: 0.65, gateStrength: 0.5, powerAlpha: 2.5 }
  // Brilliance (8k-12kHz): sibilance, cymbals
  if (freq < 12000) return { vocalWeight: 0.3, gateStrength: 0.7, powerAlpha: 2.8 }
  // Air (12k+): almost never vocals
  return { vocalWeight: 0.08, gateStrength: 0.9, powerAlpha: 3.0 }
}

// ── HPSS: Median filter ────────────────────────────────────────

/** In-place 1D median filter over a Float64Array column of a 2D spectrogram */
function medianFilter1D(values: number[], kernel: number): number[] {
  const half = (kernel - 1) >> 1
  const n = values.length
  const result = new Array<number>(n)
  const buf: number[] = []
  for (let i = 0; i < n; i++) {
    buf.length = 0
    const lo = Math.max(0, i - half)
    const hi = Math.min(n - 1, i + half)
    for (let j = lo; j <= hi; j++) buf.push(values[j])
    buf.sort((a, b) => a - b)
    result[i] = buf[buf.length >> 1]
  }
  return result
}

// ── Exports ────────────────────────────────────────────────────

export interface SeparationResult {
  vocalsL: Float32Array
  vocalsR: Float32Array
  instL: Float32Array
  instR: Float32Array
}

export interface SeparationProgress {
  phase: 'stft' | 'hpss' | 'mask' | 'wiener' | 'reconstruct'
  percent: number
}

// ── Main separation ────────────────────────────────────────────

export async function separateVocals(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  onProgress?: (p: SeparationProgress) => void,
): Promise<SeparationResult> {
  const length = left.length
  const numFrames = Math.ceil((length - FFT_SIZE) / HOP_SIZE) + 1
  const window = hanningWindow(FFT_SIZE)

  // Pre-compute per-bin band parameters
  const bandParams = new Array<BandParams>(BINS)
  for (let k = 0; k < BINS; k++) {
    bandParams[k] = getBandParams((k * sampleRate) / FFT_SIZE)
  }

  // ── Pass 1: Full STFT → magnitude spectrograms ───────────────
  // Store: magnitude of Mid, Side, Left, Right per frame per bin
  const specMidMag = new Array<Float64Array>(numFrames)
  const specSideMag = new Array<Float64Array>(numFrames)
  const specTotalMag = new Array<Float64Array>(numFrames)
  const stereoCorr = new Array<Float64Array>(numFrames) // correlation per bin
  const phaseCoherence = new Array<Float64Array>(numFrames) // phase diff coherence

  const realL = new Float64Array(FFT_SIZE)
  const imagL = new Float64Array(FFT_SIZE)
  const realR = new Float64Array(FFT_SIZE)
  const imagR = new Float64Array(FFT_SIZE)

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * HOP_SIZE
    realL.fill(0); imagL.fill(0); realR.fill(0); imagR.fill(0)

    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = offset + i
      if (idx < length) {
        realL[i] = left[idx] * window[i]
        realR[i] = right[idx] * window[i]
      }
    }

    fft(realL, imagL)
    fft(realR, imagR)

    const fMid = new Float64Array(BINS)
    const fSide = new Float64Array(BINS)
    const fTotal = new Float64Array(BINS)
    const fCorr = new Float64Array(BINS)
    const fPhase = new Float64Array(BINS)

    for (let k = 0; k < BINS; k++) {
      const lR = realL[k], lI = imagL[k]
      const rR = realR[k], rI = imagR[k]

      const mL = Math.sqrt(lR * lR + lI * lI)
      const mR = Math.sqrt(rR * rR + rI * rI)

      const midR = (lR + rR) * 0.5
      const midI = (lI + rI) * 0.5
      const sideR = (lR - rR) * 0.5
      const sideI = (lI - rI) * 0.5

      fMid[k] = Math.sqrt(midR * midR + midI * midI)
      fSide[k] = Math.sqrt(sideR * sideR + sideI * sideI)
      fTotal[k] = Math.sqrt(mL * mL + mR * mR)

      // Stereo correlation
      const crossReal = lR * rR + lI * rI
      const denom = mL * mR + EPS
      fCorr[k] = crossReal / denom

      // Phase coherence: how similar are L and R phases?
      // cos(phaseL - phaseR) = Re(L*conj(R)) / (|L|*|R|) = correlation
      // But also check magnitude balance
      const magBalance = Math.min(mL, mR) / (Math.max(mL, mR) + EPS)
      fPhase[k] = Math.max(0, fCorr[k]) * magBalance
    }

    specMidMag[frame] = fMid
    specSideMag[frame] = fSide
    specTotalMag[frame] = fTotal
    stereoCorr[frame] = fCorr
    phaseCoherence[frame] = fPhase

    if (frame % 80 === 0) {
      onProgress?.({ phase: 'stft', percent: Math.round((frame / numFrames) * 20) })
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // ── Pass 2: HPSS — Harmonic-Percussive Source Separation ─────
  // Median filter along TIME axis → harmonic (sustained = vocals, strings, pads)
  // Median filter along FREQUENCY axis → percussive (transients = drums, clicks)
  onProgress?.({ phase: 'hpss', percent: 20 })

  const harmonicMask = new Array<Float64Array>(numFrames)
  const percussiveMask = new Array<Float64Array>(numFrames)

  // For each frequency bin, median filter across time
  for (let k = 0; k < BINS; k++) {
    const timeSlice: number[] = []
    for (let f = 0; f < numFrames; f++) timeSlice.push(specTotalMag[f][k])
    const harmonicSlice = medianFilter1D(timeSlice, HPSS_KERNEL)
    for (let f = 0; f < numFrames; f++) {
      if (!harmonicMask[f]) harmonicMask[f] = new Float64Array(BINS)
      harmonicMask[f][k] = harmonicSlice[f]
    }
  }

  // For each time frame, median filter across frequency
  for (let f = 0; f < numFrames; f++) {
    const freqSlice: number[] = []
    for (let k = 0; k < BINS; k++) freqSlice.push(specTotalMag[f][k])
    const percSlice = medianFilter1D(freqSlice, HPSS_KERNEL)
    percussiveMask[f] = new Float64Array(BINS)
    for (let k = 0; k < BINS; k++) percussiveMask[f][k] = percSlice[k]
  }

  // Compute HPSS soft masks: harmonic / (harmonic + percussive)
  // Vocals are primarily harmonic, so high harmonic mask = more likely vocal
  const hpssHarmonicRatio = new Array<Float64Array>(numFrames)
  for (let f = 0; f < numFrames; f++) {
    hpssHarmonicRatio[f] = new Float64Array(BINS)
    for (let k = 0; k < BINS; k++) {
      const h = harmonicMask[f][k] * harmonicMask[f][k]
      const p = percussiveMask[f][k] * percussiveMask[f][k]
      hpssHarmonicRatio[f][k] = h / (h + p + EPS)
    }
  }

  onProgress?.({ phase: 'hpss', percent: 30 })
  await new Promise((r) => setTimeout(r, 0))

  // ── Pass 3: Build vocal mask from multiple cues ──────────────
  onProgress?.({ phase: 'mask', percent: 30 })

  const vocalMasks = new Array<Float64Array>(numFrames)
  let prevMask: Float64Array | null = null

  for (let frame = 0; frame < numFrames; frame++) {
    const mask = new Float64Array(BINS)
    const fMid = specMidMag[frame]
    const fSide = specSideMag[frame]
    const fCorr = stereoCorr[frame]
    const fPhase = phaseCoherence[frame]
    const hpss = hpssHarmonicRatio[frame]

    for (let k = 0; k < BINS; k++) {
      const bp = bandParams[k]

      // Cue 1: Mid/Side ratio (center content = vocals)
      const midEnergy = fMid[k] * fMid[k]
      const sideEnergy = fSide[k] * fSide[k]
      const midRatio = midEnergy / (midEnergy + sideEnergy + EPS)

      // Cue 2: Stereo correlation (high = center-panned)
      const corrCue = Math.max(0, fCorr[k])

      // Cue 3: Phase coherence (center content has coherent phase)
      const phaseCue = fPhase[k]

      // Cue 4: HPSS harmonic ratio (vocals are harmonic, drums are percussive)
      const hpssCue = hpss[k]

      // ── Multi-cue fusion with band-specific weighting ──
      // For vocal frequencies: emphasize mid/side and correlation
      // For non-vocal frequencies: emphasize HPSS (helps separate drums)
      const vw = bp.vocalWeight

      let rawMask =
        midRatio * 0.30 +      // center panning
        corrCue * 0.20 +       // stereo correlation
        phaseCue * 0.15 +      // phase coherence
        hpssCue * 0.15 +       // harmonic content
        vw * 0.20              // frequency prior

      // ── Power masking: sharpen boundaries ──
      // Apply power law: values near 0 get pushed to 0, values near 1 stay near 1
      rawMask = Math.pow(Math.max(0, Math.min(1, rawMask)), bp.powerAlpha)

      // ── Spectral gating: clean up quiet bleed ──
      const gateLo = GATE_LO * (0.5 + 0.5 * bp.gateStrength)
      const gateHi = GATE_HI + (1 - GATE_HI) * bp.gateStrength * 0.3
      if (rawMask < gateLo) rawMask = 0
      else if (rawMask > gateHi) rawMask = 1

      mask[k] = rawMask
    }

    // ── Temporal smoothing ──
    if (prevMask) {
      for (let k = 0; k < BINS; k++) {
        mask[k] = TEMPORAL_SMOOTH * mask[k] + (1 - TEMPORAL_SMOOTH) * prevMask[k]
      }
    }

    vocalMasks[frame] = mask
    prevMask = mask

    if (frame % 80 === 0) {
      onProgress?.({ phase: 'mask', percent: 30 + Math.round((frame / numFrames) * 15) })
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // Free memory: spectrogram arrays no longer needed except totalMag and vocalMasks
  specMidMag.length = 0
  specSideMag.length = 0
  stereoCorr.length = 0
  phaseCoherence.length = 0
  harmonicMask.length = 0
  percussiveMask.length = 0
  hpssHarmonicRatio.length = 0

  // ── Pass 4: Multi-pass Wiener refinement ─────────────────────
  onProgress?.({ phase: 'wiener', percent: 45 })

  for (let iter = 0; iter < WIENER_PASSES; iter++) {
    for (let frame = 0; frame < numFrames; frame++) {
      const mask = vocalMasks[frame]
      const mag = specTotalMag[frame]

      for (let k = 0; k < BINS; k++) {
        const bp = bandParams[k]
        const magSq = mag[k] * mag[k]

        const vocalPower = mask[k] * mask[k] * magSq + EPS
        const instPower = (1 - mask[k]) * (1 - mask[k]) * magSq + EPS
        let newMask = vocalPower / (vocalPower + instPower)

        // Reinforce band prior (lighter in later passes)
        const priorWeight = 0.3 / (iter + 1) // decreasing influence
        newMask = newMask * (1 - priorWeight) + bp.vocalWeight * priorWeight

        // Temporal smoothing with neighbors
        if (frame > 0 && frame < numFrames - 1) {
          newMask = 0.65 * newMask + 0.175 * vocalMasks[frame - 1][k] + 0.175 * vocalMasks[frame + 1][k]
        }

        // Re-apply gating after Wiener
        const gateLo = GATE_LO * (0.5 + 0.5 * bp.gateStrength)
        if (newMask < gateLo) newMask = 0
        else if (newMask > GATE_HI) newMask = 1

        mask[k] = Math.max(0, Math.min(1, newMask))
      }
    }

    onProgress?.({
      phase: 'wiener',
      percent: 45 + Math.round(((iter + 1) / WIENER_PASSES) * 15),
    })
    await new Promise((r) => setTimeout(r, 0))
  }

  // ── Pass 5: Vocal bandpass — hard frequency limits ───────────
  // Vocals: remove sub-bass (<80Hz) and ultra-high (>12kHz)
  // Instrumental: preserve everything that's not masked as vocal
  for (let frame = 0; frame < numFrames; frame++) {
    const mask = vocalMasks[frame]
    for (let k = 0; k < BINS; k++) {
      const freq = (k * sampleRate) / FFT_SIZE
      // Hard high-pass at 80Hz for vocals
      if (freq < 80) {
        mask[k] = 0 // no vocals below 80Hz, all goes to instrumental
      }
      // Gradual rolloff above 12kHz for vocals
      else if (freq > 12000) {
        const rolloff = Math.max(0, 1 - (freq - 12000) / 4000)
        mask[k] *= rolloff
      }
    }
  }

  // ── Pass 6: Reconstruct via Inverse STFT ─────────────────────
  onProgress?.({ phase: 'reconstruct', percent: 60 })

  const vocalsL = new Float32Array(length)
  const vocalsR = new Float32Array(length)
  const instL = new Float32Array(length)
  const instR = new Float32Array(length)
  const windowSum = new Float32Array(length)

  const fftRV_L = new Float64Array(FFT_SIZE)
  const fftIV_L = new Float64Array(FFT_SIZE)
  const fftRV_R = new Float64Array(FFT_SIZE)
  const fftIV_R = new Float64Array(FFT_SIZE)
  const fftRI_L = new Float64Array(FFT_SIZE)
  const fftII_L = new Float64Array(FFT_SIZE)
  const fftRI_R = new Float64Array(FFT_SIZE)
  const fftII_R = new Float64Array(FFT_SIZE)

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * HOP_SIZE
    const mask = vocalMasks[frame]

    realL.fill(0); imagL.fill(0); realR.fill(0); imagR.fill(0)
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = offset + i
      if (idx < length) {
        realL[i] = left[idx] * window[i]
        realR[i] = right[idx] * window[i]
      }
    }
    fft(realL, imagL)
    fft(realR, imagR)

    fftRV_L.fill(0); fftIV_L.fill(0)
    fftRV_R.fill(0); fftIV_R.fill(0)
    fftRI_L.fill(0); fftII_L.fill(0)
    fftRI_R.fill(0); fftII_R.fill(0)

    for (let k = 0; k < BINS; k++) {
      const m = mask[k]
      const im = 1 - m

      fftRV_L[k] = realL[k] * m
      fftIV_L[k] = imagL[k] * m
      fftRV_R[k] = realR[k] * m
      fftIV_R[k] = imagR[k] * m

      fftRI_L[k] = realL[k] * im
      fftII_L[k] = imagL[k] * im
      fftRI_R[k] = realR[k] * im
      fftII_R[k] = imagR[k] * im

      // Conjugate symmetry for real-valued output
      if (k > 0 && k < BINS - 1) {
        const mk = FFT_SIZE - k
        fftRV_L[mk] = fftRV_L[k]; fftIV_L[mk] = -fftIV_L[k]
        fftRV_R[mk] = fftRV_R[k]; fftIV_R[mk] = -fftIV_R[k]
        fftRI_L[mk] = fftRI_L[k]; fftII_L[mk] = -fftII_L[k]
        fftRI_R[mk] = fftRI_R[k]; fftII_R[mk] = -fftII_R[k]
      }
    }

    // DC and Nyquist bins must be real-valued
    fftIV_L[0] = 0; fftIV_R[0] = 0; fftII_L[0] = 0; fftII_R[0] = 0
    fftIV_L[BINS - 1] = 0; fftIV_R[BINS - 1] = 0
    fftII_L[BINS - 1] = 0; fftII_R[BINS - 1] = 0

    ifft(fftRV_L, fftIV_L); ifft(fftRV_R, fftIV_R)
    ifft(fftRI_L, fftII_L); ifft(fftRI_R, fftII_R)

    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = offset + i
      if (idx < length) {
        const w = window[i]
        vocalsL[idx] += fftRV_L[i] * w
        vocalsR[idx] += fftRV_R[i] * w
        instL[idx] += fftRI_L[i] * w
        instR[idx] += fftRI_R[i] * w
        windowSum[idx] += w * w
      }
    }

    if (frame % 80 === 0) {
      onProgress?.({
        phase: 'reconstruct',
        percent: 60 + Math.round((frame / numFrames) * 30),
      })
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // Overlap-add normalization
  for (let i = 0; i < length; i++) {
    const norm = windowSum[i] > EPS ? 1.0 / windowSum[i] : 0
    vocalsL[i] *= norm
    vocalsR[i] *= norm
    instL[i] *= norm
    instR[i] *= norm
  }

  // ── Pass 7: Energy conservation + soft clip ──────────────────
  onProgress?.({ phase: 'reconstruct', percent: 92 })

  for (let i = 0; i < length; i++) {
    const origL = left[i], origR = right[i]
    const sumL = vocalsL[i] + instL[i]
    const sumR = vocalsR[i] + instR[i]
    const resL = origL - sumL, resR = origR - sumR

    const vL = Math.abs(vocalsL[i]) + EPS
    const iL = Math.abs(instL[i]) + EPS
    vocalsL[i] += resL * (vL / (vL + iL))
    instL[i] += resL * (iL / (vL + iL))

    const vR = Math.abs(vocalsR[i]) + EPS
    const iR = Math.abs(instR[i]) + EPS
    vocalsR[i] += resR * (vR / (vR + iR))
    instR[i] += resR * (iR / (vR + iR))
  }

  // Soft-clip only samples that exceed [-1, 1] — preserve normal amplitude
  for (let i = 0; i < length; i++) {
    if (vocalsL[i] > 1) vocalsL[i] = 1
    else if (vocalsL[i] < -1) vocalsL[i] = -1
    if (vocalsR[i] > 1) vocalsR[i] = 1
    else if (vocalsR[i] < -1) vocalsR[i] = -1
    if (instL[i] > 1) instL[i] = 1
    else if (instL[i] < -1) instL[i] = -1
    if (instR[i] > 1) instR[i] = 1
    else if (instR[i] < -1) instR[i] = -1
  }

  onProgress?.({ phase: 'reconstruct', percent: 100 })
  return { vocalsL, vocalsR, instL, instR }
}
