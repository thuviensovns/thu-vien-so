/**
 * AI model ensemble — averages vocal outputs from multiple models.
 *
 * Averaging two independently-trained MDX models cancels out per-model
 * artifacts: where model A over-suppresses a vocal transient, model B
 * usually preserves it, and vice versa. This is the standard UVR technique
 * for approaching "clean as possible" separation.
 *
 * We run each model sequentially (they share the same WebGPU/WASM backend
 * and can't realistically run in parallel in-browser) and weight-average the
 * vocal stems. Instrumental is then residual = original − averagedVocals,
 * which tends to be cleaner than any single model's instrumental output.
 */

import { separateWithAI, type AISeparationResult, type AIProgress } from './ai-separator'
import { equalizeStems } from './loudness'

export interface EnsembleResult extends AISeparationResult {
  /** Number of models that were successfully used in the ensemble */
  modelsUsed: number
}

/**
 * Run each model ID and average the vocals output.
 *
 * @param modelIds Ordered list; progress is split evenly across them.
 *                 A single-ID list is equivalent to calling separateWithAI directly.
 */
export async function separateEnsemble(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  modelIds: string[],
  onProgress?: (p: AIProgress) => void,
): Promise<EnsembleResult> {
  if (modelIds.length === 0) throw new Error('Ensemble needs ≥1 model')
  const length = left.length

  // Accumulate vocal outputs across models. Weights are uniform (1/N) —
  // empirical UVR wisdom: simple mean beats tuned weights for most tracks.
  const sumVocL = new Float32Array(length)
  const sumVocR = new Float32Array(length)
  let successCount = 0

  for (let i = 0; i < modelIds.length; i++) {
    const modelId = modelIds[i]
    const slotStart = (i / modelIds.length) * 100
    const slotEnd = ((i + 1) / modelIds.length) * 100

    const result = await separateWithAI(
      left,
      right,
      sampleRate,
      (p) => {
        const pct = slotStart + (p.percent / 100) * (slotEnd - slotStart)
        onProgress?.({
          phase: p.phase,
          percent: Math.round(pct),
          detail: `[${i + 1}/${modelIds.length}] ${p.detail || ''}`.trim(),
        })
      },
      modelId,
    )

    for (let j = 0; j < length; j++) {
      sumVocL[j] += result.vocalsL[j]
      sumVocR[j] += result.vocalsR[j]
    }
    successCount++
  }

  // Mean of the accumulated vocals
  const w = 1 / successCount
  const vocalsL = new Float32Array(length)
  const vocalsR = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    vocalsL[i] = sumVocL[i] * w
    vocalsR[i] = sumVocR[i] * w
  }

  // Derive instrumental from residual. Using residual (not averaged
  // instrumentals) keeps phase coherent with the original mix.
  const instL = new Float32Array(length)
  const instR = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    instL[i] = Math.max(-1, Math.min(1, left[i] - vocalsL[i]))
    instR[i] = Math.max(-1, Math.min(1, right[i] - vocalsR[i]))
    vocalsL[i] = Math.max(-1, Math.min(1, vocalsL[i]))
    vocalsR[i] = Math.max(-1, Math.min(1, vocalsR[i]))
  }

  // Re-balance loudness (each single-model run was already equalized, but the
  // mean shifts the RMS — bring both stems back to reference level).
  equalizeStems(
    {
      vocals: { left: vocalsL, right: vocalsR },
      inst: { left: instL, right: instR },
    },
    { left, right },
  )

  return { vocalsL, vocalsR, instL, instR, modelsUsed: successCount }
}
