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

export type ModelArchitecture = 'mdx' | 'htdemucs'

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

export interface ModelEntry {
  id: string
  label: string
  /** Short description shown in UI */
  description: string
  /** ONNX URL (may be env-overridden) */
  url: string
  /** IndexedDB cache key — bump to invalidate */
  cacheKey: string
  /** Approximate download size for UI */
  sizeMB: number
  spec: MdxSpec | HtDemucsSpec
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

// ── Registry ───────────────────────────────────────────────────

export const MODELS: Record<string, ModelEntry> = {
  mdx_a: {
    id: 'mdx_a',
    label: 'MDX-A (Nhanh)',
    description: 'Cân bằng tốc độ & chất lượng — mặc định',
    url: MDX_A_URL,
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
    url: MDX_B_URL,
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
    url: HTDEMUCS_URL,
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
}

export type PresetId = 'fast' | 'quality' | 'best'

export interface Preset {
  id: PresetId
  label: string
  description: string
  /** Ordered list of model ids to run; if >1, results are ensembled */
  models: string[]
  /** Rough slowdown multiplier vs fast */
  slowdown: number
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
}

export function getModel(id: string): ModelEntry {
  const m = MODELS[id]
  if (!m) throw new Error(`Unknown model id: ${id}`)
  return m
}

export function listAvailableModels(): ModelEntry[] {
  return Object.values(MODELS).filter((m) => !m.requiresEnvUrl || !!m.url)
}

export function listAvailablePresets(): Preset[] {
  return Object.values(PRESETS).filter((p) =>
    p.models.every((id) => {
      const m = MODELS[id]
      return m && (!m.requiresEnvUrl || !!m.url)
    }),
  )
}
