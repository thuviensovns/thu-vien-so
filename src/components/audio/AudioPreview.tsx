'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface AudioPreviewProps {
  src: string
  bpm?: number | null
  musicalKey?: string | null
  duration?: number | null
}

export function AudioPreview({ src, bpm, musicalKey }: AudioPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !src) return

    let ws: any = null

    async function init() {
      const WaveSurfer = (await import('wavesurfer.js')).default
      if (!containerRef.current) return

      // Read CSS custom properties for theme-aware colors
      const styles = getComputedStyle(document.documentElement)
      const mutedColor = styles.getPropertyValue('--muted-fg').trim() || '#525252'
      const primaryColor = styles.getPropertyValue('--primary').trim() || '#00d9ff'
      const secondaryColor = styles.getPropertyValue('--secondary').trim() || '#d946ef'

      ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: mutedColor,
        progressColor: primaryColor,
        cursorColor: secondaryColor,
        height: 56,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      })

      ws.load(src)

      ws.on('ready', () => {
        setTotalDuration(ws.getDuration())
        setIsReady(true)
      })
      ws.on('play', () => setIsPlaying(true))
      ws.on('pause', () => setIsPlaying(false))
      ws.on('timeupdate', (time: number) => setCurrentTime(time))
      ws.on('finish', () => setIsPlaying(false))

      wavesurferRef.current = ws
    }

    init()

    return () => {
      ws?.destroy()
      wavesurferRef.current = null
    }
  }, [src])

  const togglePlay = useCallback(() => {
    wavesurferRef.current?.playPause()
  }, [])

  const toggleMute = useCallback(() => {
    if (!wavesurferRef.current) return
    const newMuted = !isMuted
    wavesurferRef.current.setMuted(newMuted)
    setIsMuted(newMuted)
  }, [isMuted])

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <div className="flex items-center gap-3 mb-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          disabled={!isReady}
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát nhạc'}
          className="h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(totalDuration)}</span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {bpm && (
            <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5">
              {bpm} BPM
            </Badge>
          )}
          {musicalKey && (
            <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5 text-secondary border-secondary/30">
              {musicalKey}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div ref={containerRef} className={!isReady ? 'opacity-50' : ''} />

      {!isReady && (
        <div className="h-14 flex items-center justify-center">
          <div className="h-1 w-24 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-primary/50 rounded-full animate-pulse" />
          </div>
        </div>
      )}
    </div>
  )
}
