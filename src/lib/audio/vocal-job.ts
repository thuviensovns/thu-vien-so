/**
 * Vocal separation job — module-level singleton.
 *
 * Survives React component unmounts (e.g. when user navigates to another
 * page mid-processing), so customers never lose a paid 7-track run.
 *
 * Holds raw Float32Array stems (not AudioBuffer) so that the consumer can
 * rebuild playable buffers against any AudioContext, decoupled from the
 * context used by the component that started the job.
 */

import {
  separateWithAI,
  separateMultiStemWithAI,
  type AIProgress,
} from './ai-separator'
import { separateVocals } from './vocal-separator'
import { saveJob as saveJobToHistory } from './vocal-history'
import { separateEnsemble } from './ai-ensemble'
import { separateWithHTDemucs } from './htdemucs-separator'
import { PRESETS, type PresetId } from './ai-models'
import { equalizeStems } from './loudness'
import { separateInstruments } from './multi-stem-separator'

export type JobMode = 'ai2' | 'ai4' | 'ai7' | 'dsp'
export type JobStatus = 'idle' | 'processing' | 'done' | 'error'

export interface StemPairRaw {
  left: Float32Array
  right: Float32Array
}

export interface JobResult {
  mode: JobMode
  sampleRate: number
  original: StemPairRaw
  /** AI preset used (fast / quality / best ensemble / htdemucs) */
  presetId?: PresetId | 'htdemucs'
  // 2-track
  vocals?: StemPairRaw
  instrumental?: StemPairRaw
  // 4/7-track
  drums?: StemPairRaw
  bass?: StemPairRaw
  guitar?: StemPairRaw
  piano?: StemPairRaw
  strings?: StemPairRaw
  others?: StemPairRaw
}

export interface JobState {
  status: JobStatus
  progress: number
  phase: string
  mode: JobMode | null
  fileName: string | null
  fileSize: number | null
  startedAt: number
  result: JobResult | null
  error: string | null
  /** Fee deducted for current job (so we don't charge again on retry). */
  paidFee: number
}

type Listener = (s: JobState) => void

const initial: JobState = {
  status: 'idle',
  progress: 0,
  phase: '',
  mode: null,
  fileName: null,
  fileSize: null,
  startedAt: 0,
  result: null,
  error: null,
  paidFee: 0,
}

class VocalJobManager {
  private state: JobState = { ...initial }
  private listeners = new Set<Listener>()
  private wakeLock: WakeLockSentinel | null = null
  private beforeUnloadBound = false

  getState(): JobState {
    return this.state
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.state)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    for (const l of this.listeners) l(this.state)
  }

  private setState(patch: Partial<JobState>) {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  clear() {
    if (this.state.status === 'processing') return // don't wipe an in-flight job
    this.state = { ...initial }
    this.emit()
  }

  /** Mark fee as pre-paid so UI can skip re-charge after navigation. */
  setPaidFee(fee: number) {
    this.setState({ paidFee: fee })
  }

  isBusy(): boolean {
    return this.state.status === 'processing'
  }

  private async acquireWakeLock() {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> }
      }
      if (nav.wakeLock?.request) {
        this.wakeLock = await nav.wakeLock.request('screen')
      }
    } catch {
      /* non-fatal */
    }
  }

  private async releaseWakeLock() {
    try {
      await this.wakeLock?.release()
    } catch {
      /* non-fatal */
    }
    this.wakeLock = null
  }

  private bindBeforeUnload() {
    if (this.beforeUnloadBound || typeof window === 'undefined') return
    const handler = (e: BeforeUnloadEvent) => {
      if (this.state.status === 'processing') {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }
    window.addEventListener('beforeunload', handler)
    this.beforeUnloadBound = true
  }

  /**
   * Start a job. If a job for the same file (name + size + mode) is already
   * in flight or done, no-op — caller just subscribes to current state.
   */
  async start(params: {
    mode: JobMode
    fileName: string
    fileSize: number
    sampleRate: number
    left: Float32Array
    right: Float32Array
    /** Quality preset — picks model(s) for AI modes. Ignored for 'dsp' mode. */
    presetId?: PresetId | 'htdemucs'
  }): Promise<void> {
    // Idempotent: same file + same mode + preset + already running/done → skip.
    if (
      this.state.status !== 'idle' &&
      this.state.mode === params.mode &&
      this.state.fileName === params.fileName &&
      this.state.fileSize === params.fileSize &&
      (this.state.result?.presetId || 'fast') === (params.presetId || 'fast')
    ) {
      return
    }
    // Different job requested while one is running → refuse (don't trash
    // paid work). Caller must wait for `done`/`error` and then clear().
    if (this.state.status === 'processing') return

    this.bindBeforeUnload()
    await this.acquireWakeLock()

    this.setState({
      status: 'processing',
      progress: 0,
      phase: 'Đang chuẩn bị...',
      mode: params.mode,
      fileName: params.fileName,
      fileSize: params.fileSize,
      startedAt: Date.now(),
      result: null,
      error: null,
    })

    const onProgress = (p: AIProgress) => {
      const phaseLabel: Record<AIProgress['phase'], [number, number]> = {
        download: [3, 20],
        load: [20, 25],
        stft: [25, 40],
        inference: [40, 70],
        reconstruct: [70, 80],
        stems: [80, 98],
      }
      const [start, end] = phaseLabel[p.phase] || [0, 100]
      const pct = Math.round(start + (p.percent / 100) * (end - start))
      this.setState({ progress: pct, phase: p.detail || '' })
    }

    try {
      const { mode, left, right, sampleRate } = params
      const presetId = params.presetId || 'fast'
      const original: StemPairRaw = { left, right }

      // Resolve model ids for the chosen preset (ignored by 'htdemucs' & 'dsp')
      const modelIds =
        presetId === 'htdemucs'
          ? []
          : (PRESETS[presetId as PresetId]?.models ?? ['mdx_a'])
      const primaryModel = modelIds[0] || 'mdx_a'
      const useEnsemble = modelIds.length > 1
      const useHtDemucs = presetId === 'htdemucs'

      // Helper: run the vocals separator chosen by preset. Returns {vocalsL/R, instL/R}.
      const runVocalsSep = async () => {
        if (useHtDemucs) {
          const r = await separateWithHTDemucs(left, right, sampleRate, (p) => {
            onProgress({
              phase: p.phase === 'reconstruct' ? 'reconstruct' : (p.phase as AIProgress['phase']),
              percent: p.percent,
              detail: p.detail,
            })
          })
          // Use HTDemucs vocals; derive instrumental from residual for coherence.
          const len = left.length
          const instL = new Float32Array(len)
          const instR = new Float32Array(len)
          for (let i = 0; i < len; i++) {
            instL[i] = Math.max(-1, Math.min(1, left[i] - r.vocals.left[i]))
            instR[i] = Math.max(-1, Math.min(1, right[i] - r.vocals.right[i]))
          }
          equalizeStems(
            { vocals: r.vocals, inst: { left: instL, right: instR } },
            { left, right },
          )
          return {
            vocalsL: r.vocals.left, vocalsR: r.vocals.right,
            instL, instR,
            htStems: r, // expose drums/bass/other if caller wants them
          }
        }
        if (useEnsemble) {
          const r = await separateEnsemble(left, right, sampleRate, modelIds, onProgress)
          return { vocalsL: r.vocalsL, vocalsR: r.vocalsR, instL: r.instL, instR: r.instR }
        }
        const r = await separateWithAI(left, right, sampleRate, onProgress, primaryModel)
        return { vocalsL: r.vocalsL, vocalsR: r.vocalsR, instL: r.instL, instR: r.instR }
      }

      if (mode === 'ai2') {
        const r = await runVocalsSep()
        this.setState({
          status: 'done',
          progress: 100,
          phase: 'Hoàn tất!',
          result: {
            mode, sampleRate, original, presetId,
            vocals: { left: r.vocalsL, right: r.vocalsR },
            instrumental: { left: r.instL, right: r.instR },
          },
        })
      } else if (mode === 'ai4') {
        if (useHtDemucs) {
          // HTDemucs natively produces 4 stems — use them directly.
          const r = await separateWithHTDemucs(left, right, sampleRate, (p) => {
            onProgress({ phase: p.phase as AIProgress['phase'], percent: p.percent, detail: p.detail })
          })
          this.setState({
            status: 'done', progress: 100, phase: 'Hoàn tất!',
            result: {
              mode, sampleRate, original, presetId,
              vocals: r.vocals, drums: r.drums, bass: r.bass, others: r.other,
            },
          })
        } else {
          // MDX / ensemble → vocals sep + DSP stem split of residual
          const vocs = await runVocalsSep()
          const stem = await separateInstruments(vocs.instL, vocs.instR, sampleRate, (p) => {
            this.setState({
              progress: 80 + Math.round(p.percent * 0.18),
              phase: 'Tách nhạc cụ...',
            })
          })
          const len = stem.others.left.length
          const othL = new Float32Array(len)
          const othR = new Float32Array(len)
          for (let i = 0; i < len; i++) {
            othL[i] = stem.guitar.left[i] + stem.piano.left[i] + stem.strings.left[i] + stem.others.left[i]
            othR[i] = stem.guitar.right[i] + stem.piano.right[i] + stem.strings.right[i] + stem.others.right[i]
          }
          this.setState({
            status: 'done', progress: 100, phase: 'Hoàn tất!',
            result: {
              mode, sampleRate, original, presetId,
              vocals: { left: vocs.vocalsL, right: vocs.vocalsR },
              drums: stem.drums, bass: stem.bass,
              others: { left: othL, right: othR },
            },
          })
        }
      } else if (mode === 'ai7') {
        if (useHtDemucs) {
          // HTDemucs gives 4 stems; split 'other' via DSP into guitar/piano/strings/others
          const r = await separateWithHTDemucs(left, right, sampleRate, (p) => {
            onProgress({ phase: p.phase as AIProgress['phase'], percent: Math.round(p.percent * 0.8), detail: p.detail })
          })
          const stem = await separateInstruments(r.other.left, r.other.right, sampleRate, (p) => {
            this.setState({ progress: 80 + Math.round(p.percent * 0.18), phase: 'Tách nhạc cụ từ "Khác"...' })
          })
          this.setState({
            status: 'done', progress: 100, phase: 'Hoàn tất!',
            result: {
              mode, sampleRate, original, presetId,
              vocals: r.vocals, drums: r.drums, bass: r.bass,
              guitar: stem.guitar, piano: stem.piano, strings: stem.strings, others: stem.others,
            },
          })
        } else if (useEnsemble) {
          // Ensemble vocals → DSP stem split of residual into 6 instrument stems
          const vocs = await runVocalsSep()
          const stem = await separateInstruments(vocs.instL, vocs.instR, sampleRate, (p) => {
            this.setState({ progress: 80 + Math.round(p.percent * 0.18), phase: 'Tách nhạc cụ...' })
          })
          this.setState({
            status: 'done', progress: 100, phase: 'Hoàn tất!',
            result: {
              mode, sampleRate, original, presetId,
              vocals: { left: vocs.vocalsL, right: vocs.vocalsR },
              drums: stem.drums, bass: stem.bass,
              guitar: stem.guitar, piano: stem.piano, strings: stem.strings, others: stem.others,
            },
          })
        } else {
          const r = await separateMultiStemWithAI(left, right, sampleRate, onProgress, primaryModel)
          this.setState({
            status: 'done', progress: 100, phase: 'Hoàn tất!',
            result: {
              mode, sampleRate, original, presetId,
              vocals: r.vocals, drums: r.drums, bass: r.bass,
              guitar: r.guitar, piano: r.piano, strings: r.strings, others: r.others,
            },
          })
        }
      } else {
        const r = await separateVocals(left, right, sampleRate, (p) => {
          this.setState({
            progress: 5 + Math.round(p.percent * 0.93),
            phase: 'Chế độ nhanh (DSP)...',
          })
        })
        this.setState({
          status: 'done', progress: 100, phase: 'Hoàn tất!',
          result: {
            mode, sampleRate, original,
            vocals: { left: r.vocalsL, right: r.vocalsR },
            instrumental: { left: r.instL, right: r.instR },
          },
        })
      }
      // Persist to history (IndexedDB) so it survives F5. Non-blocking.
      const finalState = this.state
      if (finalState.status === 'done' && finalState.result) {
        saveJobToHistory(finalState.result, params.fileName, params.fileSize).catch(() => {
          /* storage quota or permission — non-fatal */
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.setState({ status: 'error', error: msg, phase: 'Lỗi' })
    } finally {
      await this.releaseWakeLock()
    }
  }
}

/** Module-level singleton — survives React component remounts within the SPA. */
export const vocalJob: VocalJobManager = (() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any
  if (!g.__vocalJobSingleton) {
    g.__vocalJobSingleton = new VocalJobManager()
  }
  return g.__vocalJobSingleton as VocalJobManager
})()
