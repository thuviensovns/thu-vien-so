'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { separateVocals, type SeparationProgress } from '@/lib/audio/vocal-separator'
import {
  separateWithAI,
  separateMultiStemWithAI,
  separate4StemWithAI,
  isModelCached,
  type AIProgress,
  type MultiStemAIResult,
  type FourStemAIResult,
} from '@/lib/audio/ai-separator'

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
          setSevenTrackFee(5000) // default
        }
      })
      .catch(() => setSevenTrackFee(5000))
  }, [])

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => { audioCtxRef.current?.close() }
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

  const processAudio = useCallback(async () => {
    if (!file) return
    setProcessing(true)
    setProgress(0)
    setProgressPhase('')

    try {
      const ctx = getAudioContext()
      const arrayBuffer = await file.arrayBuffer()
      setProgress(2)
      setProgressPhase('Đang giải mã âm thanh...')

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const sampleRate = audioBuffer.sampleRate
      const length = audioBuffer.length
      const numChannels = audioBuffer.numberOfChannels

      if (numChannels < 2) {
        toast.info('File mono — cần file stereo để tách giọng tốt nhất')
        setProcessing(false)
        return
      }

      const left = audioBuffer.getChannelData(0)
      const right = audioBuffer.getChannelData(1)

      if (stemCount === 7) {
        // ── 7-Track Mode: Fee check + AI vocals + DSP instrument separation ──
        if (sevenTrackFee > 0 && !isAdmin) {
          if (!isLoggedIn) {
            toast.error('Vui lòng đăng nhập để sử dụng tính năng 7 tracks')
            setProcessing(false)
            window.location.href = `/dang-nhap?redirect=${encodeURIComponent('/cong-cu/xoa-giong-ai')}`
            return
          }
          // Deduct balance via API
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
          toast.success(`Đã trừ ${sevenTrackFee.toLocaleString('vi-VN')}đ — Đang xử lý...`)
        }

        const handleProgress = (p: AIProgress) => {
          const phaseMap: Record<AIProgress['phase'], [number, number]> = {
            download: [3, 20],
            load: [20, 25],
            stft: [25, 35],
            inference: [35, 60],
            reconstruct: [60, 65],
            stems: [65, 98],
          }
          const [start, end] = phaseMap[p.phase] || [0, 100]
          setProgress(Math.round(start + (p.percent / 100) * (end - start)))
          setProgressPhase(p.detail || '')
        }

        try {
          const stems: MultiStemAIResult = await separateMultiStemWithAI(
            left, right, sampleRate, handleProgress,
          )
          setModelReady(true)

          setMultiResult({
            original: audioBuffer,
            vocals: makeStereoBuffer(stems.vocals.left, stems.vocals.right, sampleRate),
            drums: makeStereoBuffer(stems.drums.left, stems.drums.right, sampleRate),
            bass: makeStereoBuffer(stems.bass.left, stems.bass.right, sampleRate),
            guitar: makeStereoBuffer(stems.guitar.left, stems.guitar.right, sampleRate),
            piano: makeStereoBuffer(stems.piano.left, stems.piano.right, sampleRate),
            strings: makeStereoBuffer(stems.strings.left, stems.strings.right, sampleRate),
            others: makeStereoBuffer(stems.others.left, stems.others.right, sampleRate),
          })
          setResult(null)
          setFourResult(null)
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          console.error('7-track separation failed:', errMsg, err)
          toast.error(`Lỗi tách 7 tracks: ${errMsg.slice(0, 200)}`, { duration: 15000 })
          setProcessing(false)
          return
        }
      } else if (stemCount === 4) {
        // ── 4-Track Mode: AI vocals + DSP drums/bass/others ──
        const handleProgress = (p: AIProgress) => {
          const phaseMap: Record<AIProgress['phase'], [number, number]> = {
            download: [3, 20],
            load: [20, 25],
            stft: [25, 35],
            inference: [35, 60],
            reconstruct: [60, 65],
            stems: [65, 98],
          }
          const [start, end] = phaseMap[p.phase] || [0, 100]
          setProgress(Math.round(start + (p.percent / 100) * (end - start)))
          setProgressPhase(p.detail || '')
        }

        try {
          const stems: FourStemAIResult = await separate4StemWithAI(
            left, right, sampleRate, handleProgress,
          )
          setModelReady(true)

          setFourResult({
            original: audioBuffer,
            vocals: makeStereoBuffer(stems.vocals.left, stems.vocals.right, sampleRate),
            drums: makeStereoBuffer(stems.drums.left, stems.drums.right, sampleRate),
            bass: makeStereoBuffer(stems.bass.left, stems.bass.right, sampleRate),
            others: makeStereoBuffer(stems.others.left, stems.others.right, sampleRate),
          })
          setResult(null)
          setMultiResult(null)
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          console.error('4-track separation failed:', errMsg, err)
          toast.error(`Lỗi tách 4 tracks: ${errMsg.slice(0, 200)}`, { duration: 15000 })
          setProcessing(false)
          return
        }
      } else if (mode === 'ai') {
        // ── 2-Track AI Mode ──
        const handleAIProgress = (p: AIProgress) => {
          const phaseMap: Record<AIProgress['phase'], [number, number]> = {
            download: [3, 25],
            load: [25, 30],
            stft: [30, 45],
            inference: [45, 85],
            reconstruct: [85, 98],
            stems: [85, 98],
          }
          const [start, end] = phaseMap[p.phase] || [0, 100]
          setProgress(Math.round(start + (p.percent / 100) * (end - start)))
          setProgressPhase(p.detail || '')
        }

        try {
          const aiRes = await separateWithAI(left, right, sampleRate, handleAIProgress)
          setResult({
            vocals: makeStereoBuffer(aiRes.vocalsL, aiRes.vocalsR, sampleRate),
            instrumental: makeStereoBuffer(aiRes.instL, aiRes.instR, sampleRate),
            original: audioBuffer,
          })
          setMultiResult(null)
          setFourResult(null)
          setModelReady(true)
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          console.error('AI separation failed, falling back to DSP:', errMsg, err)
          toast.error(`AI lỗi: ${errMsg.slice(0, 200)}`, { duration: 15000 })
          const dspRes = await separateVocals(left, right, sampleRate, (p) => {
            setProgress(10 + Math.round(p.percent * 0.88))
            setProgressPhase('Chế độ nhanh (DSP)...')
          })
          setResult({
            vocals: makeStereoBuffer(dspRes.vocalsL, dspRes.vocalsR, sampleRate),
            instrumental: makeStereoBuffer(dspRes.instL, dspRes.instR, sampleRate),
            original: audioBuffer,
          })
          setMultiResult(null)
          setFourResult(null)
        }
      } else {
        // ── 2-Track DSP Mode ──
        const handleDSPProgress = (p: SeparationProgress) => {
          setProgress(5 + Math.round(p.percent * 0.93))
          const labels: Record<SeparationProgress['phase'], string> = {
            stft: 'Phân tích phổ tần số...',
            hpss: 'Tách harmonic/percussive...',
            mask: 'Tạo mặt nạ tách giọng...',
            wiener: 'Lọc Wiener...',
            reconstruct: 'Tái tạo âm thanh...',
          }
          setProgressPhase(labels[p.phase])
        }
        const dspRes = await separateVocals(left, right, sampleRate, handleDSPProgress)
        setResult({
          vocals: makeStereoBuffer(dspRes.vocalsL, dspRes.vocalsR, sampleRate),
          instrumental: makeStereoBuffer(dspRes.instL, dspRes.instR, sampleRate),
          original: audioBuffer,
        })
        setMultiResult(null)
        setFourResult(null)
      }

      // Only show success after all branches complete without early return
      setProgress(100)
      setProgressPhase('Hoàn tất!')
      toast.success(`Đã tách ${stemCount} tracks xong!`)
    } catch (err) {
      console.error('Audio processing error:', err)
      toast.error('Không thể xử lý file âm thanh')
    } finally {
      setProcessing(false)
    }
  }, [file, getAudioContext, mode, stemCount, makeStereoBuffer])

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

      const wav = audioBufferToWav(buffer)
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
      URL.revokeObjectURL(url)
      toast.success(`Đã tải ${track}`)
    },
    [result, multiResult, fourResult, file],
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
        <Card>
          <CardContent className="pt-0">
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="size-10 animate-spin text-purple-500" />
              <div className="text-center">
                <p className="font-medium text-sm">Đang xử lý...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {progressPhase || 'Đang chuẩn bị...'}
                </p>
              </div>
              <div className="w-full max-w-xs bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progress}%</p>
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
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
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

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return arrayBuffer
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
