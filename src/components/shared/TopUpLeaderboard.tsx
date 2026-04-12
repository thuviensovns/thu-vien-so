'use client'

import { useState, useEffect } from 'react'
import { Trophy, Medal, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatVND } from '@/lib/format'

interface LeaderboardEntry {
  rank: number
  displayName: string
  totalAmount: number
}

interface LeaderboardData {
  month: number
  year: number
  leaderboard: LeaderboardEntry[]
}

const rankColors: Record<number, string> = {
  1: 'bg-yellow-500 text-black',
  2: 'bg-gray-400 text-black',
  3: 'bg-amber-700 text-white',
}

const amountColors: Record<number, string> = {
  1: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  2: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
  3: 'bg-amber-700/20 text-amber-400 border-amber-700/30',
}

export function TopUpLeaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/topup/leaderboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.leaderboard.length === 0) return null

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/5">
          <h3 className="font-bold flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span>TOP NẠP T.{String(data.month).padStart(2, '0')}</span>
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Bảng xếp hạng nạp tiền tháng {data.month}/{data.year}
          </p>
        </div>

        {/* Leaderboard list */}
        <div className="divide-y divide-border/50">
          {data.leaderboard.map((entry) => (
            <div
              key={entry.rank}
              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                entry.rank <= 3 ? 'bg-card' : 'bg-card/50'
              }`}
            >
              {/* Rank badge */}
              {entry.rank <= 3 ? (
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rankColors[entry.rank]}`}>
                  {entry.rank === 1 ? (
                    <Medal className="h-4 w-4" />
                  ) : (
                    entry.rank
                  )}
                </div>
              ) : (
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-muted text-muted-foreground">
                  {entry.rank}
                </div>
              )}

              {/* Name */}
              <span className={`flex-1 text-sm truncate ${
                entry.rank <= 3 ? 'font-semibold' : 'text-muted-foreground'
              }`}>
                {entry.displayName}
              </span>

              {/* Amount */}
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                amountColors[entry.rank] || 'bg-muted/50 text-muted-foreground border-border'
              }`}>
                {formatVND(entry.totalAmount)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
