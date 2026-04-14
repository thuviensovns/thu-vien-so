'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Loader2, Mic, X } from 'lucide-react'
import { vocalJob, type JobState } from '@/lib/audio/vocal-job'

/**
 * Floating bottom-right pill that shows whenever a vocal-separation job is
 * in flight or completed — survives route changes so users can navigate
 * freely without losing paid processing.
 */
export function VocalJobPill() {
  const [state, setState] = useState<JobState>(vocalJob.getState())
  const [dismissed, setDismissed] = useState(false)
  const pathname = usePathname()

  useEffect(() => vocalJob.subscribe(setState), [])

  // Reset dismiss when a new job starts
  useEffect(() => {
    if (state.status === 'processing') setDismissed(false)
  }, [state.status])

  // Hide on the tool page itself (native UI there is richer)
  const onToolPage = pathname === '/cong-cu/xoa-giong-ai'
  if (onToolPage) return null
  if (state.status === 'idle' || dismissed) return null

  const label =
    state.status === 'processing'
      ? 'Đang tách nhạc'
      : state.status === 'done'
        ? 'Đã tách xong!'
        : 'Lỗi tách nhạc'
  const color =
    state.status === 'processing'
      ? 'from-purple-500 to-pink-500'
      : state.status === 'done'
        ? 'from-emerald-500 to-teal-500'
        : 'from-red-500 to-orange-500'

  return (
    <div className="fixed bottom-4 right-4 z-[60] motion-safe:animate-fade-in-up">
      <div className="relative flex items-center gap-3 rounded-full border border-white/10 bg-background/95 backdrop-blur pl-3 pr-2 py-2 shadow-2xl max-w-[min(92vw,22rem)]">
        <div className={`relative flex items-center justify-center size-8 rounded-full bg-gradient-to-br ${color} text-white shrink-0`}>
          {state.status === 'processing' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mic className="size-4" />
          )}
        </div>
        <Link
          href="/cong-cu/xoa-giong-ai"
          className="flex-1 min-w-0"
          aria-label="Quay lại trang tách nhạc"
        >
          <p className="text-xs font-semibold leading-tight truncate">{label}</p>
          <p className="text-[11px] text-muted-foreground leading-tight truncate">
            {state.status === 'processing'
              ? `${state.progress}% — ${state.phase || '...'}`
              : state.fileName || 'Bấm để xem'}
          </p>
          {state.status === 'processing' && (
            <div className="mt-1 h-0.5 w-full bg-muted/60 rounded-full overflow-hidden">
              <div
                className={`h-full origin-left bg-gradient-to-r ${color}`}
                style={{
                  transform: `scaleX(${Math.max(0, Math.min(100, state.progress)) / 100})`,
                  transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            </div>
          )}
        </Link>
        {state.status !== 'processing' && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Đóng"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
