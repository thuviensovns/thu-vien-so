'use client'

/**
 * Admin panel: paste ONNX URLs for env-gated models (HTDemucs, RoFormer)
 * at runtime. Stored in localStorage → proxy route accepts via `?upstream=`
 * query param, host-allowlisted server-side to prevent SSRF.
 *
 * Lets us ship HTDemucs / RoFormer support without redeploying each time
 * the admin finds a new checkpoint URL on HuggingFace.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Settings, Trash2 } from 'lucide-react'
import {
  MODELS,
  getOverriddenUpstreamUrl,
  setOverriddenUpstreamUrl,
} from '@/lib/audio/ai-models'

const GATED_IDS = ['htdemucs', 'roformer'] as const

export function AIModelSettings({ onChanged }: { onChanged?: () => void }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const init: Record<string, string> = {}
    for (const id of GATED_IDS) init[id] = getOverriddenUpstreamUrl(id) || ''
    setValues(init)
  }, [open])

  const save = (id: string) => {
    const v = (values[id] || '').trim()
    if (v && !/^https:\/\//i.test(v)) {
      toast.error('URL phải bắt đầu bằng https://')
      return
    }
    setOverriddenUpstreamUrl(id, v || null)
    toast.success(v ? `Đã lưu URL cho ${MODELS[id].label}` : `Đã xoá URL ${MODELS[id].label}`)
    onChanged?.()
  }

  const clear = (id: string) => {
    setValues((s) => ({ ...s, [id]: '' }))
    setOverriddenUpstreamUrl(id, null)
    toast.success(`Đã xoá URL ${MODELS[id].label}`)
    onChanged?.()
  }

  return (
    <div className="rounded-lg border border-muted">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <span className="flex items-center gap-2 text-[12px] font-medium">
          <Settings className="size-4 text-fuchsia-400" />
          Cài đặt mô hình AI (admin)
        </span>
        <span className="text-[10px] text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-muted px-3 py-3">
          <p className="text-[10px] text-muted-foreground leading-tight">
            Dán URL ONNX từ HuggingFace / GitHub. Host phải trong allowlist.
            Lưu localStorage, không cần redeploy. Xoá trường để dùng mặc định.
          </p>
          {GATED_IDS.map((id) => {
            const m = MODELS[id]
            return (
              <div key={id} className="space-y-1">
                <label className="flex items-baseline justify-between text-[11px]">
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-[9px] text-muted-foreground">{m.sizeMB} MB</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={values[id] || ''}
                    onChange={(e) => setValues((s) => ({ ...s, [id]: e.target.value }))}
                    placeholder="https://huggingface.co/.../model.onnx"
                    className="flex-1 rounded border border-muted bg-background px-2 py-1 text-[11px] placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={() => save(id)}
                    className="rounded bg-fuchsia-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-fuchsia-500"
                  >
                    Lưu
                  </button>
                  {values[id] && (
                    <button
                      type="button"
                      onClick={() => clear(id)}
                      className="rounded border border-muted px-2 py-1 text-muted-foreground hover:text-red-400"
                      title="Xoá URL"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          <p className="text-[9px] text-muted-foreground/70 pt-1">
            Allowlist: huggingface.co, cas-bridge.xethub.hf.co, github.com,
            raw.githubusercontent.com, objects.githubusercontent.com.
          </p>
        </div>
      )}
    </div>
  )
}
