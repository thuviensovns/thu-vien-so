'use client'

import {
  RefreshCw, Save, RotateCcw, Check, ChevronDown, ChevronUp,
  Bookmark, Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface SpinFieldProps {
  label: string
  icon: React.ElementType
  description?: string
  currentValue: string
  builtIn: string[]
  custom: string[]
  isSpinning: boolean
  savedState: string | null // 'saved' | 'save-variation' | 'duplicate' | null
  isExpanded: boolean
  rows?: number
  onEdit: (value: string) => void
  onSpin: () => void
  onSaveVariation: () => void
  onReset: () => void
  onToggleExpand: () => void
  onUseVariation: (value: string) => void
  onDeleteCustomVariation: (index: number) => void
}

export default function SpinField({
  label, icon: Icon, description, currentValue,
  builtIn, custom, isSpinning, savedState, isExpanded, rows = 1,
  onEdit, onSpin, onSaveVariation, onReset, onToggleExpand,
  onUseVariation, onDeleteCustomVariation,
}: SpinFieldProps) {
  const totalPool = builtIn.length + custom.length

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold">{label}</span>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
          {totalPool} biến thể{custom.length > 0 && <span className="text-primary ml-0.5">({custom.length} tùy chỉnh)</span>}
        </Badge>
        {savedState === 'saved' && (
          <span className="text-[10px] text-success flex items-center gap-0.5"><Check className="h-3 w-3" /> Đã lưu</span>
        )}
        {savedState === 'save-variation' && (
          <span className="text-[10px] text-success flex items-center gap-0.5"><Bookmark className="h-3 w-3" /> Đã lưu biến thể!</span>
        )}
        {savedState === 'duplicate' && (
          <span className="text-[10px] text-warning">Nội dung đã tồn tại</span>
        )}
      </div>
      {description && <p className="text-[10px] text-muted-foreground mb-1.5">{description}</p>}
      <div className="flex gap-2">
        <textarea
          value={currentValue}
          onChange={(e) => onEdit(e.target.value)}
          rows={rows}
          className="flex-1 text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
        <div className="flex flex-col gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={onSpin} disabled={isSpinning} title="Spin ngẫu nhiên">
            <RefreshCw className={`h-3.5 w-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 text-primary border-primary/30 hover:bg-primary/10" onClick={onSaveVariation} title="Lưu làm biến thể mới">
            <Save className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={onReset} title="Reset về mặc định">
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <button onClick={onToggleExpand} className="mt-1.5 text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {isExpanded ? 'Ẩn' : 'Xem'} {totalPool} biến thể
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
          {builtIn.map((v, i) => (
            <div
              key={`b-${i}`}
              className={`flex items-start gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition-colors ${
                v === currentValue ? 'bg-primary/10 border border-primary/20' : 'bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <span className="flex-1 leading-relaxed">{v || <em className="text-muted-foreground">(trống)</em>}</span>
              {v !== currentValue ? (
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-primary" onClick={() => onUseVariation(v)} title="Sử dụng">
                  <Check className="h-3 w-3" />
                </Button>
              ) : (
                <Badge className="text-[8px] px-1 py-0 bg-primary/20 text-primary border-0 shrink-0">đang dùng</Badge>
              )}
            </div>
          ))}
          {custom.length > 0 && (
            <div className="pt-1 pb-0.5">
              <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">Tùy chỉnh của bạn</span>
            </div>
          )}
          {custom.map((v, i) => (
            <div
              key={`c-${i}`}
              className={`flex items-start gap-2 px-2.5 py-1.5 rounded-md text-[11px] border transition-colors ${
                v === currentValue ? 'bg-primary/10 border-primary/20' : 'border-primary/10 bg-primary/5 hover:bg-primary/10'
              }`}
            >
              <Bookmark className="h-3 w-3 text-primary shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{v}</span>
              <div className="flex items-center gap-0.5 shrink-0">
                {v !== currentValue ? (
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary" onClick={() => onUseVariation(v)} title="Sử dụng">
                    <Check className="h-3 w-3" />
                  </Button>
                ) : (
                  <Badge className="text-[8px] px-1 py-0 bg-primary/20 text-primary border-0">đang dùng</Badge>
                )}
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => onDeleteCustomVariation(i)} title="Xóa biến thể">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
