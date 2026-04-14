/**
 * AI model registry — catalogs every separator model available in the tool.
 *
 * Each entry fully describes how to download, cache, shape tensors for, and
 * interpret outputs of a given ONNX model. Adding a new model = adding one
 * entry here (plus, if the input format is novel, one branch in ai-separator).
 *
 * Architectures currently supported:
 *   - MDX-Net   (STFT CAC 4-channel spectrogram, vocals residual)
 *   - HTDemucs  (raw waveform, 4-stem direct output)   — env-gated
 */

export type ModelArchitecture = 'mdx' | 'htdemucs' | 'roformer'

export interface MdxSpec {
  architecture: 'mdx'
  /** STFT size */
  nFft: number
  /** Hop length */
  hop: number
  /** Freq bins the model expects (cropped from nFft/2+1) */
  dimF: number
  /** Time frames per segment */
  dimT: number
  /** Input channels (4 = L_real, L_imag, R_real, R_imag CAC) */
  dimC: number
  /** Gain compensation to apply to model output */
  compensate: number
}

export interface HtDemucsSpec {
  architecture: 'htdemucs'
  /** Segment length in samples (HTDemucs default ≈ 343980 @ 44.1kHz) */
  segmentSamples: number
  /** Overlap fraction between segments (0..1) */
  overlap: number
  /** Names of the 4 output stems in order produced by the model */
  outputStems: [string, string, string, string]
}

/**
 * RoFormer (Rotary Position Embedding Transformer) — SOTA architecture from
 * ZFTurbo's BS-RoFormer / Mel-RoFormer models (12.9+ SDR on MUSDB18-HQ).
 *
 * Input is band-split STFT: the spectrogram is sliced into frequency bands
 * (typically 62 bands) which are processed by a transformer with rotary
 * positional embeddings — captures long-range temporal dependencies far
 * better than MDX's U-Net.
 *
 * Browser integration requires: an exported ONNX model (input signature
 * varies per export) + a model-specific adapter (band boundaries, mel bin
 * mapping, etc.). The registry entry is wired; the runtime adapter throws
 * a clear error until a concrete export is provided via env.
 */
export interface RoFormerSpec {
  architecture: 'roformer'
  /** STFT size */
  nFft: number
  /** Hop length */
  hop: number
  /** Number of frequency bands for band-split input */
  numBands: number
  /** Time frames per segment */
  dimT: number
  /** Sample rate the model was trained at */
  sampleRate: number
}

export interface ModelEntry {
  id: string
  label: string
  /** Short description shown in UI */
  description: string
  /**
   * Client-facing URL to fetch ONNX from. Always the same-origin proxy route
   * `/api/ai-models/{id}` to bypass upstream CORS (HuggingFace only allows
   * Origin=huggingface.co). The proxy reads `upstreamUrl` server-side.
   */
  url: string
  /** Upstream ONNX URL resolved by the proxy server-side (may be env-overridden). */
  upstreamUrl: string
  /** IndexedDB cache key — bump to invalidate */
  cacheKey: string
  /** Approximate download size for UI */
  sizeMB: number
  spec: MdxSpec | HtDemucsSpec | RoFormerSpec
  /** Feature-flag: hide from UI unless the URL is configured */
  requiresEnvUrl?: boolean
}

// ── Defaults (can be overridden per-model via env) ─────────────

const MDX_A_URL =
  process.env.NEXT_PUBLIC_AI_MDX_A_URL ||
  process.env.NEXT_PUBLIC_AI_MODEL_URL || // legacy
  'https://huggingface.co/seanghay/uvr_models/resolve/main/kuielab_a_vocals.onnx'

const MDX_B_URL =
  process.env.NEXT_PUBLIC_AI_MDX_B_URL ||
  'https://huggingface.co/seanghay/uvr_models/resolve/main/kuielab_b_vocals.onnx'

const HTDEMUCS_URL = process.env.NEXT_PUBLIC_AI_HTDEMUCS_URL || ''
const ROFORMER_URL = process.env.NEXT_PUBLIC_AI_ROFORMER_URL || ''

// ── Registry ───────────────────────────────────────────────────

export const MODELS: Record<string, ModelEntry> = {
  mdx_a: {
    id: 'mdx_a',
    label: 'MDX-A (Nhanh)',
    description: 'Cân bằng tốc độ & chất lượng — mặc định',
    url: '/api/ai-models/mdx_a',
    upstreamUrl: MDX_A_URL,
    cacheKey: process.env.NEXT_PUBLIC_AI_MDX_A_KEY || 'kuielab_a_vocals_v1',
    sizeMB: 58,
    spec: {
      architecture: 'mdx',
      nFft: 6144,
      hop: 1024,
      dimF: 2048,
      dimT: 512,
      dimC: 4,
      compensate: Number(process.env.NEXT_PUBLIC_AI_MDX_A_COMPENSATE) || 1.035,
    },
  },
  mdx_b: {
    id: 'mdx_b',
    label: 'MDX-B (Cao cấp)',
    description: 'Giữ chi tiết giọng hát tốt hơn, chậm hơn ~10%',
    url: '/api/ai-models/mdx_b',
    upstreamUrl: MDX_B_URL,
    cacheKey: process.env.NEXT_PUBLIC_AI_MDX_B_KEY || 'kuielab_b_vocals_v1',
    sizeMB: 58,
    spec: {
      architecture: 'mdx',
      nFft: 6144,
      hop: 1024,
      dimF: 2048,
      dimT: 512,
      dimC: 4,
      compensate: Number(process.env.NEXT_PUBLIC_AI_MDX_B_COMPENSATE) || 1.035,
    },
  },
  htdemucs: {
    id: 'htdemucs',
    label: 'HTDemucs (Chất lượng studio)',
    description: 'Hybrid Transformer, 4 stems, chậm hơn ~3x',
    url: '/api/ai-models/htdemucs',
    upstreamUrl: HTDEMUCS_URL,
    cacheKey: process.env.NEXT_PUBLIC_AI_HTDEMUCS_KEY || 'htdemucs_v4',
    sizeMB: 80,
    requiresEnvUrl: !HTDEMUCS_URL,
    spec: {
      architecture: 'htdemucs',
      segmentSamples: 343980,
      overlap: 0.25,
      outputStems: ['drums', 'bass', 'other', 'vocals'],
    },
  },
  roformer: {
    id: 'roformer',
    label: 'BS-RoFormer (SOTA)',
    description: 'Band-split Rotary Transformer — điểm SDR cao nhất hiện có',
    url: '/api/ai-models/roformer',
    upstreamUrl: ROFORMER_URL,
    cacheKey: process.env.NEXT_PUBLIC_AI_ROFORMER_KEY || 'bs_roformer_v1',
    sizeMB: 170,
    requiresEnvUrl: !ROFORMER_URL,
    spec: {
      architecture: 'roformer',
      nFft: 2048,
      hop: 512,
      numBands: 62,
      dimT: 801,
      sampleRate: 44100,
    },
  },
}

export type PresetId = 'fast' | 'quality' | 'best' | 'ultra' | 'roformer'

export interface Preset {
  id: PresetId
  label: string
  description: string
  /** Ordered list of model ids to run; if >1, results are ensembled */
  models: string[]
  /** Rough slowdown multiplier vs fast */
  slowdown: number
  /** Run each model with Test-Time Augmentation (2x inference, +0.3-0.5 dB SDR) */
  tta?: boolean
  /**
   * Overlap fraction override for waveform models (HTDemucs).
   * Higher = fewer seam artifacts, quadratic cost. Default per model spec.
   */
  overlap?: number
}

/**
 * User-facing quality presets — selecting one picks a model or an ensemble.
 * Ensemble is the closest to "100% clean": averaging two independently-trained
 * models cancels out per-model artifacts.
 */
export const PRESETS: Record<PresetId, Preset> = {
  fast: {
    id: 'fast',
    label: 'Nhanh',
    description: 'MDX-A — chất lượng tốt, tốc độ nhanh',
    models: ['mdx_a'],
    slowdown: 1,
  },
  quality: {
    id: 'quality',
    label: 'Cao cấp',
    description: 'MDX-B — chi tiết giọng hát cao hơn',
    models: ['mdx_b'],
    slowdown: 1.1,
  },
  best: {
    id: 'best',
    label: 'Tốt nhất (Ensemble)',
    description: 'Kết hợp MDX-A + MDX-B — sạch nhất, chậm ~2x',
    models: ['mdx_a', 'mdx_b'],
    slowdown: 2,
  },
  ultra: {
    id: 'ultra',
    label: 'Tối đa (Ensemble + TTA)',
    description: 'Ensemble + Test-Time Augmentation — tiệm cận giới hạn SOTA, chậm ~4x',
    models: ['mdx_a', 'mdx_b'],
    slowdown: 4,
    tta: true,
    overlap: 0.5,
  },
  roformer: {
    id: 'roformer',
    label: 'BS-RoFormer (SOTA)',
    description: 'Band-split Rotary Transformer — SDR cao nhất, chậm ~3x',
    models: ['roformer'],
    slowdown: 3,
  },
}

export function getModel(id: string): ModelEntry {
  const m = MODELS[id]
  if (!m) throw new Error(`Unknown model id: ${id}`)
  return m
}

/**
 * Runtime URL override — admin can paste an ONNX URL into localStorage
 * without redeploying. The client appends `?upstream=` to the proxy route
 * and the server validates the host against the allowlist.
 */
export function getOverriddenUpstreamUrl(id: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(`ai_upstream_override:${id}`) || null
  } catch {
    return null
  }
}

export function setOverriddenUpstreamUrl(id: string, url: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (url) window.localStorage.setItem(`ai_upstream_override:${id}`, url)
    else window.localStorage.removeItem(`ai_upstream_override:${id}`)
  } catch { /* quota / privacy mode */ }
}

/**
 * Returns the client-facing URL to fetch the ONNX from. If the admin has
 * pasted a runtime override, encode it into the proxy's `?upstream=` param.
 */
export function resolveClientModelUrl(id: string): string {
  const m = getModel(id)
  const override = getOverriddenUpstreamUrl(id)
  if (override) return `${m.url}?upstream=${encodeURIComponent(override)}`
  return m.url
}

function modelConfigured(m: ModelEntry): boolean {
  if (!m.requiresEnvUrl) return true
  if (m.upstreamUrl) return true
  return !!getOverriddenUpstreamUrl(m.id)
}

export function listAvailableModels(): ModelEntry[] {
  return Object.values(MODELS).filter(modelConfigured)
}

export function listAvailablePresets(): Preset[] {
  return Object.values(PRESETS).filter((p) =>
    p.models.every((id) => {
      const m = MODELS[id]
      return !!m && modelConfigured(m)
    }),
  )
}
