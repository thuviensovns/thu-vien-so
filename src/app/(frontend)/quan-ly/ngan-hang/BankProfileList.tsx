'use client'

import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface SavedBankProfile {
  id: string
  label: string
  account: { bankBin: string; bankName: string; accountNumber: string; accountName: string }
  isActive: boolean
  createdAt: string
}

interface BankProfileListProps {
  profiles: SavedBankProfile[]
  onActivate: (id: string) => void
  onDelete: (id: string) => void
  onToggleForm: () => void
}

export default function BankProfileList({ profiles, onActivate, onDelete, onToggleForm }: BankProfileListProps) {
  if (profiles.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold">Hồ sơ đã lưu</h3>
        <Button size="sm" variant="ghost" onClick={onToggleForm} className="text-xs">
          <Plus className="mr-1 h-3 w-3" />Thêm hồ sơ
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {profiles.map((profile) => (
          <Card
            key={profile.id}
            className={`border-border bg-card cursor-pointer transition-colors hover:border-primary/30 ${
              profile.isActive ? 'border-primary/50 bg-primary/5' : ''
            }`}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold truncate">{profile.label}</span>
                  {profile.isActive && (
                    <Badge className="bg-success/10 text-success border-success/20 text-[10px] px-1 py-0">Đang dùng</Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); onDelete(profile.id) }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-0.5 text-[11px] text-muted-foreground">
                <p>{profile.account.bankName}</p>
                <p className="font-mono">{profile.account.accountNumber}</p>
                <p>{profile.account.accountName}</p>
              </div>
              {!profile.isActive && (
                <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs" onClick={() => onActivate(profile.id)}>
                  <CheckCircle2 className="mr-1 h-3 w-3" />Kích hoạt
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
