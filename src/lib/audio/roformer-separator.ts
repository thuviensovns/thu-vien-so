/**
 * BS-RoFormer (Band-Split Rotary Position Embedding Transformer) — adapter.
 *
 * Architecture (ZFTurbo / lucidrains reference impl):
 *   - STFT → complex spectrogram [F, T]
 *   - Split freq bins into `numBands` bands (non-uniform, dense at low freq)
 *   - Per-band linear projection → token sequence
 *   - Rotary-PE transformer over (band × time) axes interleaved
 *   - Per-band decoder → mask → apply to original spec → ISTFT
 *
 * Why advanced:
 *   - Rotary PE handles arbitrary sequence length far better than sinusoidal
 *   - Band-split preserves fine frequency structure that U-Nets blur
 *   - MUSDB18-HQ vocals SDR ≈ 12.9 dB vs MDX-Net's ≈ 10.8 dB
 *
 * Why stubbed:
 *   - The PyTorch reference has no canonical ONNX export; input/output names
 *     and exact band boundaries vary per-checkpoint. Shipping a runtime
 *     adapter without a verified ONNX model would silently produce noise.
 *   - Once a concrete ONNX export is hosted at NEXT_PUBLIC_AI_ROFORMER_URL
 *     with a documented I/O signature, implement the adapter in this file.
 */

import { getModel } from './ai-models'

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

export async function separateWithRoFormer(
  _left: Float32Array,
  _right: Float32Array,
  _sampleRate: number,
  _onProgress?: (p: RoFormerProgress) => void,
): Promise<RoFormerResult> {
  const model = getModel('roformer')
  if (!model.upstreamUrl) {
    throw new Error(
      'RoFormer chưa được cấu hình — cần NEXT_PUBLIC_AI_ROFORMER_URL + adapter ' +
        'band-split. Xem docs/ai-separation-research.md để biết yêu cầu I/O.',
    )
  }
  throw new Error(
    'RoFormer adapter chưa implement — upstream ONNX cần mô tả input signature ' +
      '(band boundaries, channel layout) trước khi hoàn thiện.',
  )
}
