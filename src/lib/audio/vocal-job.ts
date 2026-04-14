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
  separate4StemWithAI,
  type AIProgress,
} from './ai-separator'
import { separateVocals } from './vocal-separator'

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
  }): Promise<void> {
    // Idempotent: same file + same mode + already running/done → skip.
    if (
      this.state.status !== 'idle' &&
      this.state.mode === params.mode &&
      this.state.fileName === params.fileName &&
      this.state.fileSize === params.fileSize
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
      const original: StemPairRaw = { left, right }

      if (mode === 'ai2') {
        const r = await separateWithAI(left, right, sampleRate, onProgress)
        this.setState({
          status: 'done',
          progress: 100,
          phase: 'Hoàn tất!',
          result: {
            mode, sampleRate, original,
            vocals: { left: r.vocalsL, right: r.vocalsR },
            instrumental: { left: r.instL, right: r.instR },
          },
        })
      } else if (mode === 'ai4') {
        const r = await separate4StemWithAI(left, right, sampleRate, onProgress)
        this.setState({
          status: 'done', progress: 100, phase: 'Hoàn tất!',
          result: {
            mode, sampleRate, original,
            vocals: r.vocals, drums: r.drums, bass: r.bass, others: r.others,
          },
        })
      } else if (mode === 'ai7') {
        const r = await separateMultiStemWithAI(left, right, sampleRate, onProgress)
        this.setState({
          status: 'done', progress: 100, phase: 'Hoàn tất!',
          result: {
            mode, sampleRate, original,
            vocals: r.vocals, drums: r.drums, bass: r.bass,
            guitar: r.guitar, piano: r.piano, strings: r.strings, others: r.others,
          },
        })
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
