'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload,
  Music,
  Mic,
  MicOff,
  Download,
  Play,
  Pause,
  Loader2,
  RotateCcw,
  Volume2,
  Sparkles,
  Zap,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Lock, Coins } from 'lucide-react'
import { isModelCached } from '@/lib/audio/ai-separator'
import { vocalJob, type JobMode } from '@/lib/audio/vocal-job'
import { VocalHistoryList } from './VocalHistoryList'
import type { HistoryRecord } from '@/lib/audio/vocal-history'
import { listAvailablePresets, type PresetId } from '@/lib/audio/ai-models'
import { AIModelSettings } from './AIModelSettings'

interface ProcessedAudio {
  vocals: AudioBuffer
  instrumental: AudioBuffer
  original: AudioBuffer
}

interface MultiStemAudio {
  original: AudioBuffer
  vocals: AudioBuffer
  drums: AudioBuffer
  bass: AudioBuffer
  guitar: AudioBuffer
  piano: AudioBuffer
  strings: AudioBuffer
  others: AudioBuffer
}

interface FourStemAudio {
  original: AudioBuffer
  vocals: AudioBuffer
  drums: AudioBuffer
  bass: AudioBuffer
  others: AudioBuffer
}

const STEM_TRACKS = [
  { key: 'vocals', label: 'Vocals', desc: 'Giọng hát', color: 'pink' },
  { key: 'drums', label: 'Drums', desc: 'Trống', color: 'orange' },
  { key: 'bass', label: 'Bass', desc: 'Bass', color: 'blue' },
  { key: 'guitar', label: 'Guitar', desc: 'Guitar', color: 'yellow' },
  { key: 'piano', label: 'Piano', desc: 'Piano', color: 'purple' },
  { key: 'strings', label: 'Strings', desc: 'Dây', color: 'green' },
  { key: 'others', label: 'Others', desc: 'Khác', color: 'gray' },
] as const

const FOUR_STEM_TRACKS = [
  { key: 'vocals', label: 'Vocals', desc: 'Giọng hát', color: 'pink' },
  { key: 'drums', label: 'Drums', desc: 'Trống', color: 'orange' },
  { key: 'bass', label: 'Bass', desc: 'Bass', color: 'blue' },
  { key: 'others', label: 'Others', desc: 'Khác', color: 'gray' },
] as const

type StemKey = (typeof STEM_TRACKS)[number]['key']

const STEM_COLORS: Record<string, { bg: string; text: string; hover: string; dot: string }> = {
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-500', hover: 'hover:bg-pink-500/20', dot: 'bg-pink-500' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-500', hover: 'hover:bg-orange-500/20', dot: 'bg-orange-500' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', hover: 'hover:bg-blue-500/20', dot: 'bg-blue-500' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', hover: 'hover:bg-yellow-500/20', dot: 'bg-yellow-500' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', hover: 'hover:bg-purple-500/20', dot: 'bg-purple-500' },
  green: { bg: 'bg-green-500/10', text: 'text-green-500', hover: 'hover:bg-green-500/20', dot: 'bg-green-500' },
  gray: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', hover: 'hover:bg-zinc-500/20', dot: 'bg-zinc-400' },
}

type TrackType = 'vocals' | 'instrumental'
type SepMode = 'ai' | 'dsp'
type StemCount = 2 | 4 | 7

export function VocalRemover() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressPhase, setProgressPhase] = useState('')
  const [result, setResult] = useState<ProcessedAudio | null>(null)
  const [multiResult, setMultiResult] = useState<MultiStemAudio | null>(null)
  const [fourResult, setFourResult] = useState<FourStemAudio | null>(null)
  const [playing, setPlaying] = useState<TrackType | 'original' | StemKey | null>(null)
  const [mode, setMode] = useState<SepMode>('ai')
  const [stemCount, setStemCount] = useState<StemCount>(2)
  const [modelReady, setModelReady] = useState<boolean | null>(null)

  // Fee/balance state for 7-track
  const [userBalance, setUserBalance] = useState<number | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sevenTrackFee, setSevenTrackFee] = useState(0)

  const [currentTime, setCurrentTime] = useState(0)
  const [trackDuration, setTrackDuration] = useState(0)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [presetsVersion, setPresetsVersion] = useState(0)
  const [preset, setPreset] = useState<PresetId | 'htdemucs'>('fast')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availablePresets = useMemo(() => listAvailablePresets(), [presetsVersion])

  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const playStateRef = useRef<{ track: string; startedAt: number; offset: number } | null>(null)
  const rafRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if model is cached on mount
  useEffect(() => {
    isModelCached().then(setModelReady)
  }, [])

  // Fetch user balance + site settings (fee)
  useEffect(() => {
    // Get balance
    fetch('/api/vocal-remover/use-credit', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUserBalance(data.balance)
          setIsLoggedIn(true)
          setIsAdmin(data.isAdmin || false)
        }
      })
      .catch(() => {})
    // Get fee from site settings
    fetch('/api/site-content')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.settings?.sevenTrackFee !== undefined) {
          setSevenTrackFee(data.settings.sevenTrackFee)
        } else {
          setSevenTrackFee(15) // default
        }
      })
      .catch(() => setSevenTrackFee(15))
  }, [])

  // Cleanup AudioContext on unmount — keep alive if a job is still processing
  // (singleton job survives unmount so user can navigate away without losing work).
  useEffect(() => {
    return () => {
      if (vocalJob.isBusy()) return
      audioCtxRef.current?.close()
    }
  }, [])

  // Subscribe to global job state — hydrates UI on mount (e.g. when user
  // navigates back to this page while a job is still in flight).
  useEffect(() => {
    const unsub = vocalJob.subscribe((s) => {
      if (s.status === 'processing') {
        setProcessing(true)
        setProgress(s.progress)
        setProgressPhase(s.phase)
      } else if (s.status === 'done' && s.result) {
        setProcessing(false)
        setProgress(100)
        setProgressPhase('Hoàn tất!')
        // Bump history so the freshly completed job appears in the list
        setHistoryRefresh((n) => n + 1)
      } else if (s.status === 'error') {
        setProcessing(false)
      }
    })
    return unsub
  }, [])

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }, [])

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith('audio/')) {
      toast.error('Vui lòng chọn file âm thanh (MP3, WAV, FLAC...)')
      return
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('File quá lớn. Tối đa 50MB.')
      return
    }
    setFile(selectedFile)
    setResult(null)
    setMultiResult(null)
    setFourResult(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) handleFileSelect(droppedFile)
    },
    [handleFileSelect],
  )

  const makeStereoBuffer = useCallback(
    (left: Float32Array, right: Float32Array, sampleRate: number) => {
      const ctx = getAudioContext()
      const buf = ctx.createBuffer(2, left.length, sampleRate)
      buf.getChannelData(0).set(left)
      buf.getChannelData(1).set(right)
      return buf
    },
    [getAudioContext],
  )

  // Load a previously-saved job from IndexedDB history. Rebuilds AudioBuffers
  // and slots them into the right result state based on stored mode.
  const handleLoadFromHistory = useCallback(
    (record: HistoryRecord) => {
      // Inline stop (stopPlayback declared later — avoid TDZ in dep array)
      cancelAnimationFrame(rafRef.current)
      if (sourceRef.current) {
        sourceRef.current.onended = null
        try { sourceRef.current.stop() } catch { /* already stopped */ }
        sourceRef.current.disconnect()
        sourceRef.current = null
      }
      playStateRef.current = null
      setPlaying(null)
      setCurrentTime(0)
      setResult(null)
      setMultiResult(null)
      setFourResult(null)
      vocalJob.clear()

      // Synthesize a File-like stub so downloadTrack's baseName derivation works.
      // Use a zero-byte File so the "please reprocess" check elsewhere doesn't
      // try to re-upload the same content.
      const stubFile = new File([new Uint8Array(0)], record.fileName, {
        type: 'audio/wav',
      })
      setFile(stubFile)

      const sr = record.sampleRate
      const stems = record.stems
      // Build a silent "original" buffer since we don't persist the source mix.
      const len = stems[Object.keys(stems)[0]].left.length
      const orig = makeStereoBuffer(new Float32Array(len), new Float32Array(len), sr)

      if (record.mode === 'ai7') {
        setMultiResult({
          original: orig,
          vocals: makeStereoBuffer(stems.vocals.left, stems.vocals.right, sr),
          drums: makeStereoBuffer(stems.drums.left, stems.drums.right, sr),
          bass: makeStereoBuffer(stems.bass.left, stems.bass.right, sr),
          guitar: makeStereoBuffer(stems.guitar.left, stems.guitar.right, sr),
          piano: makeStereoBuffer(stems.piano.left, stems.piano.right, sr),
          strings: makeStereoBuffer(stems.strings.left, stems.strings.right, sr),
          others: makeStereoBuffer(stems.others.left, stems.others.right, sr),
        })
      } else if (record.mode === 'ai4') {
        setFourResult({
          original: orig,
          vocals: makeStereoBuffer(stems.vocals.left, stems.vocals.right, sr),
          drums: makeStereoBuffer(stems.drums.left, stems.drums.right, sr),
          bass: makeStereoBuffer(stems.bass.left, stems.bass.right, sr),
          others: makeStereoBuffer(stems.others.left, stems.others.right, sr),
        })
      } else if (stems.vocals && stems.instrumental) {
        setResult({
          vocals: makeStereoBuffer(stems.vocals.left, stems.vocals.right, sr),
          instrumental: makeStereoBuffer(stems.instrumental.left, stems.instrumental.right, sr),
          original: orig,
        })
      }
    },
    [makeStereoBuffer],
  )

  // Hydrate AudioBuffers from singleton when a job result exists (e.g. user
  // navigated back to the page while job finished on its own).
  useEffect(() => {
    const s = vocalJob.getState()
    if (s.status !== 'done' || !s.result) return
    const r = s.result
    const sr = r.sampleRate
    const orig = makeStereoBuffer(r.original.left, r.original.right, sr)
    if (r.mode === 'ai7' && r.drums && r.guitar && r.piano && r.strings && r.others && r.bass && r.vocals) {
      setMultiResult({
        original: orig,
        vocals: makeStereoBuffer(r.vocals.left, r.vocals.right, sr),
        drums: makeStereoBuffer(r.drums.left, r.drums.right, sr),
        bass: makeStereoBuffer(r.bass.left, r.bass.right, sr),
        guitar: makeStereoBuffer(r.guitar.left, r.guitar.right, sr),
        piano: makeStereoBuffer(r.piano.left, r.piano.right, sr),
        strings: makeStereoBuffer(r.strings.left, r.strings.right, sr),
        others: makeStereoBuffer(r.others.left, r.others.right, sr),
      })
    } else if (r.mode === 'ai4' && r.vocals && r.drums && r.bass && r.others) {
      setFourResult({
        original: orig,
        vocals: makeStereoBuffer(r.vocals.left, r.vocals.right, sr),
        drums: makeStereoBuffer(r.drums.left, r.drums.right, sr),
        bass: makeStereoBuffer(r.bass.left, r.bass.right, sr),
        others: makeStereoBuffer(r.others.left, r.others.right, sr),
      })
    } else if ((r.mode === 'ai2' || r.mode === 'dsp') && r.vocals && r.instrumental) {
      setResult({
        vocals: makeStereoBuffer(r.vocals.left, r.vocals.right, sr),
        instrumental: makeStereoBuffer(r.instrumental.left, r.instrumental.right, sr),
        original: orig,
      })
    }
  }, [processing, makeStereoBuffer])

  const processAudio = useCallback(async () => {
    if (!file) return
    if (vocalJob.isBusy()) {
      toast.info('Đang có job đang xử lý. Vui lòng đợi hoàn tất.')
      return
    }
    const jobModeDesired: JobMode = stemCount === 7
      ? 'ai7'
      : stemCount === 4 ? 'ai4' : mode === 'ai' ? 'ai2' : 'dsp'
    // Guard: if singleton already has a completed result for this exact
    // file + mode, don't re-charge or re-process — just surface it.
    const existing = vocalJob.getState()
    if (
      existing.status === 'done' &&
      existing.fileName === file.name &&
      existing.fileSize === file.size &&
      existing.mode === jobModeDesired
    ) {
      toast.info('Đã có kết quả — hiển thị lại.')
      return
    }
    // Reset any stale result from a previous completed job.
    vocalJob.clear()
    setResult(null)
    setMultiResult(null)
    setFourResult(null)
    setProcessing(true)
    setProgress(2)
    setProgressPhase('Đang giải mã âm thanh...')

    try {
      const ctx = getAudioContext()
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const sampleRate = audioBuffer.sampleRate
      const numChannels = audioBuffer.numberOfChannels

      if (numChannels < 2) {
        toast.info('File mono — cần file stereo để tách giọng tốt nhất')
        setProcessing(false)
        return
      }

      // Copy channel data so it's independent of the AudioBuffer (which is
      // bound to this component's AudioContext and may be gc'd on unmount).
      const left = new Float32Array(audioBuffer.getChannelData(0))
      const right = new Float32Array(audioBuffer.getChannelData(1))

      // ── 7-Track: fee/balance check ─────────────────────────────
      if (stemCount === 7 && sevenTrackFee > 0 && !isAdmin) {
        if (!isLoggedIn) {
          toast.error('Vui lòng đăng nhập để sử dụng tính năng 7 tracks')
          setProcessing(false)
          window.location.href = `/dang-nhap?redirect=${encodeURIComponent('/cong-cu/xoa-giong-ai')}`
          return
        }
        // Skip re-charge if this same file was already paid for in a prior
        // run that's still in the singleton (e.g. user navigated away then
        // re-clicked Process without clearing).
        const s = vocalJob.getState()
        const alreadyPaid = s.paidFee === sevenTrackFee && s.fileName === file.name && s.fileSize === file.size
        if (!alreadyPaid) {
          const creditRes = await fetch('/api/vocal-remover/use-credit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fee: sevenTrackFee }),
          })
          const creditData = await creditRes.json()
          if (!creditRes.ok) {
            if (creditRes.status === 402) {
              toast.error(`Số dư không đủ. Cần ${sevenTrackFee.toLocaleString('vi-VN')}đ, hiện có ${(creditData.balance || 0).toLocaleString('vi-VN')}đ`, { duration: 8000 })
            } else {
              toast.error(creditData.error || 'Không thể trừ tiền')
            }
            setProcessing(false)
            return
          }
          setUserBalance(creditData.newBalance)
          vocalJob.setPaidFee(sevenTrackFee)
          toast.success(`Đã trừ ${sevenTrackFee.toLocaleString('vi-VN')}đ — Đang xử lý song song, bạn có thể rời trang.`)
        } else {
          toast.info('Tiếp tục job đã thanh toán trước đó...')
        }
      }

      await vocalJob.start({
        mode: jobModeDesired,
        fileName: file.name,
        fileSize: file.size,
        sampleRate,
        left,
        right,
        presetId: jobModeDesired === 'dsp' ? undefined : preset,
      })

      const final = vocalJob.getState()
      if (final.status === 'error') {
        toast.error(`Lỗi tách: ${(final.error || '').slice(0, 200)}`, { duration: 15000 })
        return
      }
      if (final.status === 'done' && final.result) {
        const r = final.result
        const sr = r.sampleRate
        const orig = audioBuffer
        if (r.mode === 'ai7' && r.vocals && r.drums && r.bass && r.guitar && r.piano && r.strings && r.others) {
          setMultiResult({
            original: orig,
            vocals: makeStereoBuffer(r.vocals.left, r.vocals.right, sr),
            drums: makeStereoBuffer(r.drums.left, r.drums.right, sr),
            bass: makeStereoBuffer(r.bass.left, r.bass.right, sr),
            guitar: makeStereoBuffer(r.guitar.left, r.guitar.right, sr),
            piano: makeStereoBuffer(r.piano.left, r.piano.right, sr),
            strings: makeStereoBuffer(r.strings.left, r.strings.right, sr),
            others: makeStereoBuffer(r.others.left, r.others.right, sr),
          })
        } else if (r.mode === 'ai4' && r.vocals && r.drums && r.bass && r.others) {
          setFourResult({
            original: orig,
            vocals: makeStereoBuffer(r.vocals.left, r.vocals.right, sr),
            drums: makeStereoBuffer(r.drums.left, r.drums.right, sr),
            bass: makeStereoBuffer(r.bass.left, r.bass.right, sr),
            others: makeStereoBuffer(r.others.left, r.others.right, sr),
          })
        } else if (r.vocals && r.instrumental) {
          setResult({
            vocals: makeStereoBuffer(r.vocals.left, r.vocals.right, sr),
            instrumental: makeStereoBuffer(r.instrumental.left, r.instrumental.right, sr),
            original: orig,
          })
        }
        setModelReady(true)
        toast.success(`Đã tách ${stemCount} tracks xong!`)
      }
    } catch (err) {
      console.error('Audio processing error:', err)
      toast.error('Không thể xử lý file âm thanh')
    } finally {
      setProcessing(false)
    }
  }, [file, getAudioContext, mode, stemCount, makeStereoBuffer, sevenTrackFee, isAdmin, isLoggedIn, preset])

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (sourceRef.current) {
      sourceRef.current.onended = null
      sourceRef.current.stop()
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    playStateRef.current = null
    setPlaying(null)
    setCurrentTime(0)
  }, [])

  const getBuffer = useCallback(
    (track: string): AudioBuffer | undefined => {
      if (multiResult) return multiResult[track as keyof MultiStemAudio]
      if (fourResult) return fourResult[track as keyof FourStemAudio]
      if (result) {
        if (track === 'vocals') return result.vocals
        if (track === 'instrumental') return result.instrumental
        if (track === 'original') return result.original
      }
      return undefined
    },
    [result, multiResult, fourResult],
  )

  const playTrackAt = useCallback(
    (track: string, offset = 0) => {
      // Stop any existing playback
      cancelAnimationFrame(rafRef.current)
      if (sourceRef.current) {
        sourceRef.current.onended = null
        sourceRef.current.stop()
        sourceRef.current.disconnect()
        sourceRef.current = null
      }

      const buffer = getBuffer(track)
      if (!buffer) return

      const ctx = getAudioContext()
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.onended = () => {
        playStateRef.current = null
        setPlaying(null)
        setCurrentTime(0)
        cancelAnimationFrame(rafRef.current)
      }
      source.start(0, offset)
      sourceRef.current = source

      playStateRef.current = { track, startedAt: ctx.currentTime, offset }
      setPlaying(track as TrackType | 'original' | StemKey)
      setTrackDuration(buffer.duration)
      setCurrentTime(offset)

      // Animate progress
      const tick = () => {
        if (playStateRef.current && audioCtxRef.current) {
          const elapsed = audioCtxRef.current.currentTime - playStateRef.current.startedAt
          const cur = playStateRef.current.offset + elapsed
          setCurrentTime(Math.min(cur, buffer.duration))
          rafRef.current = requestAnimationFrame(tick)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [getBuffer, getAudioContext],
  )

  const playTrack = useCallback(
    (track: TrackType | 'original' | StemKey) => {
      if (playing === track) {
        stopPlayback()
        return
      }
      playTrackAt(track, 0)
    },
    [playing, stopPlayback, playTrackAt],
  )

  const seekTo = useCallback(
    (time: number) => {
      if (!playStateRef.current) return
      const track = playStateRef.current.track
      playTrackAt(track, time)
    },
    [playTrackAt],
  )

  const downloadTrack = useCallback(
    async (track: TrackType | StemKey) => {
      if (!file) return
      let buffer: AudioBuffer | undefined
      if (multiResult) {
        buffer = multiResult[track as keyof MultiStemAudio]
      } else if (fourResult) {
        buffer = fourResult[track as keyof FourStemAudio]
      } else if (result) {
        buffer = track === 'vocals' ? result.vocals : result.instrumental
      }
      if (!buffer) return

      // Show loading toast for tracks > 2 minutes (encode may take >1s)
      const longTrack = buffer.duration > 120
      const toastId = longTrack ? toast.loading(`Đang tạo WAV ${track}...`) : undefined
      try {
        const wav = await audioBufferToWav(buffer)
        const blob = new Blob([wav], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const baseName = file.name.replace(/\.[^.]+$/, '')
        a.href = url
        a.download = `${baseName}_${track}.wav`
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        a.remove()
        // Revoke a tick later so the download actually starts on Safari/iOS
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        if (toastId !== undefined) toast.dismiss(toastId)
        toast.success(`Đã tải ${track}`)
      } catch (err) {
        if (toastId !== undefined) toast.dismiss(toastId)
        console.error('WAV encode/download failed:', err)
        toast.error('Tải WAV thất bại — thử lại?')
      }
    },
    [result, multiResult, fourResult, file],
  )

  const downloadAllTracks = useCallback(
    async () => {
      if (!file) return
      let tracks: (TrackType | StemKey)[] = []
      if (multiResult) tracks = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'strings', 'others']
      else if (fourResult) tracks = ['vocals', 'drums', 'bass', 'others']
      else if (result) tracks = ['vocals', 'instrumental']
      if (tracks.length === 0) return

      const toastId = toast.loading(`Đang tạo ${tracks.length} file WAV...`)
      try {
        for (let i = 0; i < tracks.length; i++) {
          toast.loading(`Đang tạo ${tracks[i]} (${i + 1}/${tracks.length})...`, { id: toastId })
          await downloadTrack(tracks[i])
          // Brief gap so the browser's download manager queues each file cleanly
          await new Promise((r) => setTimeout(r, 400))
        }
        toast.success(`Đã tải tất cả ${tracks.length} tracks`, { id: toastId })
      } catch {
        toast.error('Lỗi khi tải — một vài file có thể chưa tải xong.', { id: toastId })
      }
    },
    [file, multiResult, fourResult, result, downloadTrack],
  )

  const handleReset = useCallback(() => {
    stopPlayback()
    setFile(null)
    setResult(null)
    setMultiResult(null)
    setFourResult(null)
    setProgress(0)
  }, [stopPlayback])

  const hasResult = result !== null || multiResult !== null || fourResult !== null

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Reusable seek bar for a track
  const renderSeekBar = (trackKey: string, colorClass: string) => {
    const isActive = playing === trackKey
    const buf = getBuffer(trackKey)
    const dur = buf?.duration || 0
    const cur = isActive ? currentTime : 0
    const pct = dur > 0 ? (cur / dur) * 100 : 0

    return (
      <div className="w-full mt-2">
        <div
          className="relative h-5 cursor-pointer group flex items-center"
          onClick={(e) => {
            const bar = e.currentTarget.querySelector('[data-seek-bar]') as HTMLElement
            if (!bar) return
            const rect = bar.getBoundingClientRect()
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
            const targetTime = ratio * dur
            if (isActive) {
              seekTo(targetTime)
            } else {
              playTrackAt(trackKey, targetTime)
            }
          }}
        >
          {/* Track bar */}
          <div data-seek-bar className="relative w-full h-1.5 bg-muted/50 rounded-full overflow-visible">
            {/* Fill */}
            <div
              className={`h-full rounded-full ${colorClass} overflow-visible relative`}
              style={{ width: `${pct}%`, minWidth: isActive || pct > 0 ? '4px' : '0px' }}
            >
              {/* Thumb dot at the right edge of the fill */}
              <div
                className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 size-3.5 rounded-full ${colorClass} shadow-lg ring-2 ring-background group-hover:scale-125 transition-transform`}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
          <span>{isActive ? formatTime(cur) : '0:00'}</span>
          <span>{dur > 0 ? formatTime(dur) : '--:--'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-2.5">
          <div className="flex items-center justify-center size-10 rounded-xl bg-purple-500/10">
            <MicOff className="size-6 text-purple-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">Xóa Giọng Hát AI</h1>
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Tách giọng hát và nhạc nền bằng AI — xử lý ngay trên trình duyệt
        </p>
      </div>

      {/* History panel — shows completed jobs from IndexedDB, survives F5 */}
      {!processing && (
        <VocalHistoryList onLoad={handleLoadFromHistory} refreshKey={historyRefresh} />
      )}

      {/* Upload Area */}
      {!file && !hasResult && (
        <Card>
          <CardContent className="pt-0">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed rounded-xl cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
            >
              <div className="flex items-center justify-center size-16 rounded-2xl bg-purple-500/10">
                <Upload className="size-8 text-purple-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Kéo thả file âm thanh vào đây</p>
                <p className="text-xs text-muted-foreground mt-1">
                  hoặc click để chọn file (MP3, WAV, FLAC — tối đa 50MB)
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* File Selected - Process */}
      {file && !hasResult && !processing && (
        <Card>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center gap-3 py-2">
              <div className="flex items-center justify-center size-10 rounded-lg bg-purple-500/10">
                <Music className="size-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <Button onClick={handleReset} variant="ghost" size="icon" className="shrink-0">
                <RotateCcw className="size-4" />
              </Button>
            </div>

            {/* Stem count selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setStemCount(2)}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all ${
                  stemCount === 2
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-muted hover:border-purple-500/30'
                }`}
              >
                <Mic className={`size-4 shrink-0 ${stemCount === 2 ? 'text-purple-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className={`text-xs font-medium ${stemCount === 2 ? 'text-purple-500' : ''}`}>
                    2 Tracks
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Vocals, Nhạc nền</p>
                </div>
              </button>
              <button
                onClick={() => { setStemCount(4); setMode('ai') }}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all ${
                  stemCount === 4
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-muted hover:border-cyan-500/30'
                }`}
              >
                <Layers className={`size-4 shrink-0 ${stemCount === 4 ? 'text-cyan-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className={`text-xs font-medium ${stemCount === 4 ? 'text-cyan-500' : ''}`}>
                    4 Tracks
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Vocals, Drums, Bass, Others</p>
                </div>
              </button>
              <button
                onClick={() => { setStemCount(7); setMode('ai') }}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all ${
                  stemCount === 7
                    ? 'border-pink-500 bg-pink-500/10'
                    : 'border-muted hover:border-pink-500/30'
                }`}
              >
                <Layers className={`size-4 shrink-0 ${stemCount === 7 ? 'text-pink-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className={`text-xs font-medium ${stemCount === 7 ? 'text-pink-500' : ''}`}>
                    7 Tracks
                  </p>
                  {sevenTrackFee > 0 && !isAdmin ? (
                    <p className="text-[10px] text-amber-500 font-medium leading-tight flex items-center gap-0.5">
                      <Coins className="size-2.5" />
                      {sevenTrackFee.toLocaleString('vi-VN')}đ/lần
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground leading-tight">Vocals, Drums, Bass...</p>
                  )}
                </div>
              </button>
            </div>

            {/* AI quality preset selector — picks which model(s) to run.
                Hidden in DSP mode (no AI involved). */}
            {mode === 'ai' && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                  Chất lượng AI
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {availablePresets.map((p) => {
                    const active = preset === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPreset(p.id)}
                        className={`flex flex-col gap-0.5 rounded-lg border p-2 text-left transition-all ${
                          active
                            ? 'border-fuchsia-500 bg-fuchsia-500/10'
                            : 'border-muted hover:border-fuchsia-500/30'
                        }`}
                      >
                        <span className={`text-[11px] font-semibold ${active ? 'text-fuchsia-400' : ''}`}>
                          {p.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {p.description}
                        </span>
                        {p.slowdown > 1 && (
                          <span className="text-[9px] text-amber-500/80 mt-0.5">
                            ~{p.slowdown}× thời gian
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {isAdmin && (
                  <div className="mt-2">
                    <AIModelSettings onChanged={() => setPresetsVersion((v) => v + 1)} />
                  </div>
                )}
              </div>
            )}

            {/* Mode selector (only for 2-track) */}
            {stemCount === 2 && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('ai')}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
                    mode === 'ai'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-muted hover:border-purple-500/30'
                  }`}
                >
                  <Sparkles
                    className={`size-4 ${mode === 'ai' ? 'text-purple-500' : 'text-muted-foreground'}`}
                  />
                  <div>
                    <p className={`text-xs font-medium ${mode === 'ai' ? 'text-purple-500' : ''}`}>
                      AI (MDX-Net)
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Chất lượng cao{modelReady ? '' : ' · Tải ~30MB'}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setMode('dsp')}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
                    mode === 'dsp'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-muted hover:border-emerald-500/30'
                  }`}
                >
                  <Zap
                    className={`size-4 ${mode === 'dsp' ? 'text-emerald-500' : 'text-muted-foreground'}`}
                  />
                  <div>
                    <p className={`text-xs font-medium ${mode === 'dsp' ? 'text-emerald-500' : ''}`}>
                      Nhanh (DSP)
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Không cần tải model
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Balance info for 7-track */}
            {stemCount === 7 && sevenTrackFee > 0 && !isAdmin && (
              <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <Coins className="size-3.5 text-amber-500" />
                  <span className="text-muted-foreground">Phí sử dụng:</span>
                  <span className="font-semibold text-amber-500">{sevenTrackFee.toLocaleString('vi-VN')}đ</span>
                </div>
                {isLoggedIn && userBalance !== null && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Số dư: </span>
                    <span className={`font-semibold ${userBalance >= sevenTrackFee ? 'text-emerald-500' : 'text-red-500'}`}>
                      {userBalance.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={processAudio}
              className="w-full gap-2"
              disabled={stemCount === 7 && sevenTrackFee > 0 && !isAdmin && isLoggedIn && userBalance !== null && userBalance < sevenTrackFee}
            >
              {stemCount === 7 ? (
                <>
                  {sevenTrackFee > 0 && !isAdmin && !isLoggedIn ? (
                    <Lock className="size-4" />
                  ) : (
                    <Layers className="size-4" />
                  )}
                  Tách 7 Tracks bằng AI
                  {sevenTrackFee > 0 && !isAdmin && (
                    <span className="text-[10px] opacity-75">({sevenTrackFee.toLocaleString('vi-VN')}đ)</span>
                  )}
                </>
              ) : stemCount === 4 ? (
                <>
                  <Layers className="size-4" />
                  Tách 4 Tracks bằng AI
                </>
              ) : mode === 'ai' ? (
                <>
                  <Sparkles className="size-4" />
                  Tách giọng bằng AI
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Tách giọng nhanh
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Processing */}
      {processing && (
        <Card className="overflow-hidden border-purple-500/20 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-pink-500/[0.03]">
          <CardContent className="pt-0">
            <div className="flex flex-col items-center gap-5 sm:gap-6 py-8 sm:py-10">
              {/* Radial progress — compositor-friendly (transform/opacity only) */}
              <div className="relative size-24 sm:size-28">
                {/* Pulsing glow halo */}
                <div className="absolute inset-0 rounded-full bg-purple-500/25 blur-2xl motion-safe:animate-vr-pulse motion-reduce:opacity-40" />
                {/* Rotating gradient ring */}
                <svg
                  className="relative size-full -rotate-90 motion-safe:will-change-transform"
                  viewBox="0 0 100 100"
                  aria-hidden
                >
                  <defs>
                    <linearGradient id="vr-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" className="text-muted/40" strokeWidth="6" />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="url(#vr-grad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={2 * Math.PI * 44 * (1 - Math.max(0, Math.min(100, progress)) / 100)}
                    style={{ transition: 'stroke-dashoffset 400ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                  />
                </svg>
                {/* Center percent */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl sm:text-2xl font-bold tabular-nums bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                    {progress}%
                  </span>
                </div>
              </div>

              <div className="text-center max-w-[22rem] px-4">
                <p className="font-semibold text-sm sm:text-base">Đang xử lý</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 min-h-[2.25em]">
                  {progressPhase || 'Đang chuẩn bị...'}
                </p>
              </div>

              {/* Linear bar — GPU-accelerated via transform: scaleX */}
              <div className="w-full max-w-sm px-2">
                <div className="relative h-1.5 sm:h-2 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 right-0 origin-left rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500"
                    style={{
                      transform: `scaleX(${Math.max(0, Math.min(100, progress)) / 100})`,
                      transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                  {/* Shimmer sweep */}
                  <div className="pointer-events-none absolute inset-0 motion-safe:animate-vr-shimmer motion-reduce:hidden bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results — 2-Track Mode */}
      {result && !multiResult && !fourResult && (
        <Card>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center gap-3 py-1">
              <div className="flex items-center justify-center size-10 rounded-lg bg-purple-500/10">
                <Music className="size-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{file?.name}</p>
                <p className="text-xs text-muted-foreground">Đã xử lý xong</p>
              </div>
              <Button
                onClick={downloadAllTracks}
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                title="Tải WAV tất cả các tracks"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Tải tất cả</span>
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm" className="gap-1.5 shrink-0">
                <RotateCcw className="size-3.5" />
                File khác
              </Button>
            </div>

            <Tabs defaultValue="vocals">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="original" className="gap-1.5">
                  <Volume2 className="size-3.5" />
                  Gốc
                </TabsTrigger>
                <TabsTrigger value="vocals" className="gap-1.5">
                  <Mic className="size-3.5" />
                  Giọng hát
                </TabsTrigger>
                <TabsTrigger value="instrumental" className="gap-1.5">
                  <Music className="size-3.5" />
                  Nhạc nền
                </TabsTrigger>
              </TabsList>

              <TabsContent value="original">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => playTrack('original')}
                      className="flex items-center justify-center size-10 rounded-full bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                    >
                      {playing === 'original' ? (
                        <Pause className="size-5 text-purple-500" />
                      ) : (
                        <Play className="size-5 text-purple-500 ml-0.5" />
                      )}
                    </button>
                    <div>
                      <p className="font-medium text-sm">Bản gốc</p>
                      <p className="text-xs text-muted-foreground">
                        {result.original.duration.toFixed(1)}s
                      </p>
                    </div>
                  </div>
                </div>
                {renderSeekBar('original', 'bg-purple-500')}
              </TabsContent>

              <TabsContent value="vocals">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => playTrack('vocals')}
                      className="flex items-center justify-center size-10 rounded-full bg-pink-500/10 hover:bg-pink-500/20 transition-colors"
                    >
                      {playing === 'vocals' ? (
                        <Pause className="size-5 text-pink-500" />
                      ) : (
                        <Play className="size-5 text-pink-500 ml-0.5" />
                      )}
                    </button>
                    <div>
                      <p className="font-medium text-sm">Giọng hát (Vocals)</p>
                      <p className="text-xs text-muted-foreground">
                        Chỉ giọng hát, không có nhạc nền
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadTrack('vocals')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 transition-colors"
                  >
                    <Download className="size-3.5" />
                    Tải WAV
                  </button>
                </div>
                {renderSeekBar('vocals', 'bg-pink-500')}
              </TabsContent>

              <TabsContent value="instrumental">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => playTrack('instrumental')}
                      className="flex items-center justify-center size-10 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                    >
                      {playing === 'instrumental' ? (
                        <Pause className="size-5 text-emerald-500" />
                      ) : (
                        <Play className="size-5 text-emerald-500 ml-0.5" />
                      )}
                    </button>
                    <div>
                      <p className="font-medium text-sm">Nhạc nền (Instrumental)</p>
                      <p className="text-xs text-muted-foreground">
                        Chỉ nhạc nền, không có giọng hát
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadTrack('instrumental')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Download className="size-3.5" />
                    Tải WAV
                  </button>
                </div>
                {renderSeekBar('instrumental', 'bg-emerald-500')}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Results — 7-Track Mode */}
      {multiResult && (
        <Card>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center gap-3 py-1">
              <div className="flex items-center justify-center size-10 rounded-lg bg-pink-500/10">
                <Layers className="size-5 text-pink-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{file?.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-blue-500 text-white leading-none">7 tracks</span>
                  <p className="text-xs text-muted-foreground">Đã tách xong</p>
                </div>
              </div>
              <Button
                onClick={downloadAllTracks}
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                title="Tải WAV tất cả các tracks"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Tải tất cả</span>
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm" className="gap-1.5 shrink-0">
                <RotateCcw className="size-3.5" />
                File khác
              </Button>
            </div>

            {/* Original track */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => playTrack('original')}
                  className="flex items-center justify-center size-9 rounded-full bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                >
                  {playing === 'original' ? (
                    <Pause className="size-4 text-purple-500" />
                  ) : (
                    <Play className="size-4 text-purple-500 ml-0.5" />
                  )}
                </button>
                <div>
                  <p className="font-medium text-sm">Bản gốc</p>
                  <p className="text-xs text-muted-foreground">{multiResult.original.duration.toFixed(1)}s</p>
                </div>
              </div>
              {renderSeekBar('original', 'bg-purple-500')}
            </div>

            {/* Stem tracks */}
            <div className="space-y-2">
              {STEM_TRACKS.map((stem) => {
                const c = STEM_COLORS[stem.color]
                return (
                  <div key={stem.key} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => playTrack(stem.key)}
                          className={`flex items-center justify-center size-9 rounded-full ${c.bg} ${c.hover} transition-colors`}
                        >
                          {playing === stem.key ? (
                            <Pause className={`size-4 ${c.text}`} />
                          ) : (
                            <Play className={`size-4 ${c.text} ml-0.5`} />
                          )}
                        </button>
                        <div className="flex items-center gap-2">
                          <div className={`size-2.5 rounded-full ${c.dot}`} />
                          <div>
                            <p className="font-medium text-sm">{stem.label}</p>
                            <p className="text-xs text-muted-foreground">{stem.desc}</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadTrack(stem.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${c.bg} ${c.text} ${c.hover} transition-colors shrink-0`}
                      >
                        <Download className="size-3.5" />
                        WAV
                      </button>
                    </div>
                    {renderSeekBar(stem.key, c.dot)}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results — 4-Track Mode */}
      {fourResult && (
        <Card>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center gap-3 py-1">
              <div className="flex items-center justify-center size-10 rounded-lg bg-cyan-500/10">
                <Layers className="size-5 text-cyan-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{file?.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-cyan-500 text-white leading-none">4 tracks</span>
                  <p className="text-xs text-muted-foreground">Đã tách xong</p>
                </div>
              </div>
              <Button
                onClick={downloadAllTracks}
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                title="Tải WAV tất cả các tracks"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Tải tất cả</span>
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm" className="gap-1.5 shrink-0">
                <RotateCcw className="size-3.5" />
                File khác
              </Button>
            </div>

            {/* Original track */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => playTrack('original')}
                  className="flex items-center justify-center size-9 rounded-full bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                >
                  {playing === 'original' ? (
                    <Pause className="size-4 text-purple-500" />
                  ) : (
                    <Play className="size-4 text-purple-500 ml-0.5" />
                  )}
                </button>
                <div>
                  <p className="font-medium text-sm">Bản gốc</p>
                  <p className="text-xs text-muted-foreground">{fourResult.original.duration.toFixed(1)}s</p>
                </div>
              </div>
              {renderSeekBar('original', 'bg-purple-500')}
            </div>

            {/* 4 Stem tracks */}
            <div className="space-y-2">
              {FOUR_STEM_TRACKS.map((stem) => {
                const c = STEM_COLORS[stem.color]
                return (
                  <div key={stem.key} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => playTrack(stem.key)}
                          className={`flex items-center justify-center size-9 rounded-full ${c.bg} ${c.hover} transition-colors`}
                        >
                          {playing === stem.key ? (
                            <Pause className={`size-4 ${c.text}`} />
                          ) : (
                            <Play className={`size-4 ${c.text} ml-0.5`} />
                          )}
                        </button>
                        <div className="flex items-center gap-2">
                          <div className={`size-2.5 rounded-full ${c.dot}`} />
                          <div>
                            <p className="font-medium text-sm">{stem.label}</p>
                            <p className="text-xs text-muted-foreground">{stem.desc}</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadTrack(stem.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${c.bg} ${c.text} ${c.hover} transition-colors shrink-0`}
                      >
                        <Download className="size-3.5" />
                        WAV
                      </button>
                    </div>
                    {renderSeekBar(stem.key, c.dot)}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      {!file && !hasResult && !processing && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="flex flex-col items-center gap-2 rounded-xl border p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center size-10 rounded-lg bg-pink-500/10">
                <Mic className="size-5 text-pink-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium">Tách giọng</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                  AI MDX-Net
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-xl border p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center size-10 rounded-lg bg-emerald-500/10">
                <Music className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium">Tách nhạc</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                  Lấy beat/karaoke
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-xl border p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center size-10 rounded-lg bg-purple-500/10">
                <Volume2 className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium">Miễn phí</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                  Xử lý trên máy
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="pt-0">
              <h2 className="font-semibold text-sm mb-3">Hướng dẫn sử dụng</h2>
              <ol className="space-y-2.5">
                {[
                  'Tải lên file nhạc (MP3, WAV, FLAC — tối đa 50MB)',
                  'Chọn chế độ AI (chất lượng cao) hoặc Nhanh (DSP)',
                  'Nghe thử và tải về giọng hát hoặc nhạc nền',
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-muted-foreground leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-[10px] sm:text-xs text-muted-foreground text-center pb-4">
        Xử lý hoàn toàn trên trình duyệt. File của bạn không được tải lên server.
      </p>
    </div>
  )
}

// ── WAV encoder ──────────────────────────────────────────────
// 16-bit PCM stereo. Encoding yields to the event loop every CHUNK samples
// so long tracks (10+ minutes) don't freeze the tab during download.
async function audioBufferToWav(buffer: AudioBuffer): Promise<ArrayBuffer> {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataSize = buffer.length * blockAlign
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalSize - 8, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch))
  }

  const YIELD_EVERY = 262144 // ~6s of stereo @44.1kHz — balances UI responsiveness with encode speed
  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
    if ((i & (YIELD_EVERY - 1)) === YIELD_EVERY - 1) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return arrayBuffer
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
