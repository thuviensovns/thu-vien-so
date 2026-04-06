'use client'

import { Activity, HardDrive, Wifi, WifiOff, Database } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { SystemHealth } from '@/lib/admin-security'

interface Props {
  health: SystemHealth | null
}

export function SystemStatus({ health }: Props) {
  if (!health) {
    return (
      <Card className="border-border bg-card animate-pulse">
        <CardContent className="p-3 h-10" />
      </Card>
    )
  }

  const statusColor = {
    online: 'text-success',
    degraded: 'text-warning',
    offline: 'text-destructive',
    unknown: 'text-muted-foreground',
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-3">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          {/* API Status */}
          <div className="flex items-center gap-1.5">
            {health.apiStatus === 'offline' ? (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <Wifi className="h-3.5 w-3.5 text-success" />
            )}
            <span className="text-muted-foreground">API:</span>
            <span className={`font-medium ${statusColor[health.apiStatus]}`}>
              {health.apiStatus === 'online' ? 'Online' : health.apiStatus === 'degraded' ? 'Chậm' : 'Offline'}
            </span>
          </div>

          {/* DB Status */}
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">DB:</span>
            <span className={`font-medium ${statusColor[health.dbStatus]}`}>
              {health.dbStatus === 'online' ? 'Online' : health.dbStatus === 'offline' ? 'Offline' : '?'}
            </span>
          </div>

          {/* Response time */}
          {health.responseTimeMs > 0 && (
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Ping:</span>
              <span className={`font-mono font-medium ${
                health.responseTimeMs < 300 ? 'text-success' :
                health.responseTimeMs < 1000 ? 'text-warning' : 'text-destructive'
              }`}>
                {health.responseTimeMs}ms
              </span>
            </div>
          )}

          {/* Storage */}
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Storage:</span>
            <span className="font-mono font-medium">{health.storageUsed}</span>
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  health.storagePercent < 50 ? 'bg-success' :
                  health.storagePercent < 80 ? 'bg-warning' : 'bg-destructive'
                }`}
                style={{ width: `${Math.min(health.storagePercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
