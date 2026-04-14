'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, Trash2, Play, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  listJobs,
  loadJob,
  deleteJob,
  type HistoryMeta,
  type HistoryRecord,
} from '@/lib/audio/vocal-history'

interface Props {
  onLoad: (record: HistoryRecord) => void
  /** Triggered by parent (e.g. after a new job completes) to refresh the list. */
  refreshKey?: number
}

const MODE_LABEL: Record<string, string> = {
  ai2: '2 tracks',
  ai4: '4 tracks',
  ai7: '7 tracks',
  dsp: 'DSP',
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VocalHistoryList({ onLoad, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<HistoryMeta[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(() => {
    listJobs().then((list) => {
      setItems(list)
      if (list.length > 0) setOpen(true)
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])

  const handleLoad = useCallback(
    async (id: string) => {
      setLoadingId(id)
      try {
        const record = await loadJob(id)
        if (!record) {
          toast.error('Không tải được lịch sử — có thể đã bị xoá.')
          refresh()
          return
        }
        onLoad(record)
        toast.success('Đã tải kết quả cũ.')
      } finally {
        setLoadingId(null)
      }
    },
    [onLoad, refresh],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteJob(id)
      setItems((prev) => prev.filter((m) => m.id !== id))
      toast.success('Đã xoá khỏi lịch sử.')
    },
    [],
  )

  if (items.length === 0) return null

  return (
    <Card className="border-white/10 bg-background/40 backdrop-blur">
      <CardContent className="p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 text-left"
          aria-expanded={open}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-purple-400" />
            Lịch sử ({items.length})
          </span>
          <span className="text-xs text-muted-foreground">
            {open ? 'Ẩn' : 'Hiện'}
          </span>
        </button>

        {open && (
          <ul className="mt-3 space-y-2">
            {items.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-muted/30 p-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{m.fileName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 mr-1.5">
                      {MODE_LABEL[m.mode] || m.mode}
                    </span>
                    {formatDuration(m.durationSec)} · {formatDate(m.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 gap-1"
                  onClick={() => handleLoad(m.id)}
                  disabled={loadingId !== null}
                  aria-label="Tải lại"
                >
                  {loadingId === m.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  <span className="hidden sm:inline text-xs">Mở</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => handleDelete(m.id)}
                  disabled={loadingId !== null}
                  aria-label="Xoá"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
