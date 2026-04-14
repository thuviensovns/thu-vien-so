/**
 * Cross-stem loudness equalization.
 *
 * After vocal/instrument separation, each stem has very different RMS — the
 * drums may be loud, piano barely audible. For playback/download we want all
 * stems to sit at a similar perceived level so users can listen without
 * adjusting volume between tracks.
 *
 * Approach: normalize every non-silent stem to the RMS of the original mix,
 * then apply a soft peak limiter at -0.5 dBFS to prevent clipping.
 */

const SILENCE_RMS = 1e-4 // below this, treat as silent and don't amplify
const MAX_GAIN = 8 // cap gain so noise in near-silent stems isn't blown up
const PEAK_CEILING = 0.94 // ≈ -0.5 dBFS

export interface StemChannels {
  left: Float32Array
  right: Float32Array
}

export function rms(left: Float32Array, right: Float32Array): number {
  const n = left.length
  if (n === 0) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const l = left[i]
    const r = right[i]
    sum += l * l + r * r
  }
  return Math.sqrt(sum / (2 * n))
}

export function applyGain(left: Float32Array, right: Float32Array, gain: number): void {
  if (gain === 1) return
  const n = left.length
  for (let i = 0; i < n; i++) {
    left[i] *= gain
    right[i] *= gain
  }
}

/** Soft peak limiter — tanh-based, preserves transients better than hard clip. */
export function peakLimit(left: Float32Array, right: Float32Array, ceiling = PEAK_CEILING): void {
  const n = left.length
  // Find current peak
  let peak = 0
  for (let i = 0; i < n; i++) {
    const a = Math.abs(left[i])
    const b = Math.abs(right[i])
    if (a > peak) peak = a
    if (b > peak) peak = b
  }
  if (peak <= ceiling) return
  // Pre-scale so peak reaches ~1.0, then soft-clip via tanh, then scale to ceiling.
  const preGain = 1 / peak
  for (let i = 0; i < n; i++) {
    left[i] = Math.tanh(left[i] * preGain) * ceiling
    right[i] = Math.tanh(right[i] * preGain) * ceiling
  }
}

/**
 * Equalize loudness across stems so each sits near the original mix's RMS.
 *
 * @param stems       Map of stem name → {left, right}
 * @param reference   Original mix used as loudness reference
 */
export function equalizeStems(
  stems: Record<string, StemChannels>,
  reference: StemChannels,
): void {
  const refRms = rms(reference.left, reference.right)
  if (refRms < SILENCE_RMS) return

  for (const stem of Object.values(stems)) {
    const r = rms(stem.left, stem.right)
    if (r < SILENCE_RMS) continue // keep silent stems silent
    const gain = Math.min(MAX_GAIN, refRms / r)
    applyGain(stem.left, stem.right, gain)
    peakLimit(stem.left, stem.right)
  }
}
