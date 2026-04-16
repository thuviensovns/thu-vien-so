'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Clock, Play, Power, CheckCircle2, XCircle, Loader2, Info,
  AlertTriangle, RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface CronRow {
  key: string
  name: string
  description: string
  recommendedInterval: string
  lastRunAt: string | null
  lastStatus: 'ok' | 'error' | null
  lastDurationMs: number | null
  lastError: string | null
  runCount: number
  enabled: boolean
  updatedAt: string
  isRegistered: boolean
}

export default function CronPage() {
  const [jobs, setJobs] = useState<CronRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cron', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setJobs(data.docs || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  async function handleRun(key: string) {
    setRunning(key)
    try {
      const res = await fetch('/api/admin/cron/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(`✓ ${data.message || 'OK'} (${data.durationMs}ms)`)
      } else {
        toast.error(`✗ ${data.message || data.error || 'Lỗi không xác định'}`)
      }
      fetchJobs()
    } catch {
      toast.error('Lỗi mạng')
    }
    setRunning(null)
  }

  async function handleToggle(key: string, enabled: boolean) {
    try {
      const res = await fetch('/api/admin/cron', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, enabled }),
      })
      if (res.ok) {
        toast.success(enabled ? 'Đã bật' : 'Đã tắt')
        fetchJobs()
      }
    } catch { toast.error('Lỗi mạng') }
  }

  function formatRelative(iso: string | null): string {
    if (!iso) return 'chưa chạy'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'vừa xong'
    if (mins < 60) return `${mins}p trước`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h trước`
    const days = Math.floor(hours / 24)
    return `${days}n trước`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Cron Jobs
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {jobs.length} jobs · {jobs.filter((j) => j.enabled).length} đang bật
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchJobs}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Làm mới
        </Button>
      </div>

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-3 flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Có thể chạy jobs thủ công từ đây, hoặc cấu hình scheduler bên ngoài (cron-job.org / Vercel Cron) gọi:</p>
            <code className="block bg-muted/50 px-2 py-1 rounded text-[10px] font-mono break-all">
              GET /api/admin/cron/run?key=JOB_KEY&amp;token=CRON_SECRET
            </code>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : jobs.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Chưa có cron job nào được đăng ký
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Card key={job.key} className={job.enabled ? '' : 'opacity-60'}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                    job.lastStatus === 'error' ? 'bg-destructive/10' :
                    job.lastStatus === 'ok' ? 'bg-success/10' : 'bg-muted/50'
                  }`}>
                    {job.lastStatus === 'error' ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : job.lastStatus === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium">{job.name}</p>
                      {job.recommendedInterval && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                          mỗi {job.recommendedInterval}
                        </Badge>
                      )}
                      {!job.isRegistered && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-warning/30 text-warning">
                          không có handler
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{job.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground font-mono">
                      <span>Lần cuối: {formatRelative(job.lastRunAt)}</span>
                      {job.lastDurationMs !== null && <span>· {job.lastDurationMs}ms</span>}
                      <span>· {job.runCount} lần</span>
                    </div>
                    {job.lastError && (
                      <div className="mt-1.5 text-[10px] bg-destructive/10 text-destructive p-1.5 rounded flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="break-all">{job.lastError}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRun(job.key)}
                      disabled={running === job.key || !job.isRegistered}
                      className="h-7 px-2"
                    >
                      {running === job.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant={job.enabled ? 'default' : 'outline'}
                      onClick={() => handleToggle(job.key, !job.enabled)}
                      className="h-7 px-2"
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
