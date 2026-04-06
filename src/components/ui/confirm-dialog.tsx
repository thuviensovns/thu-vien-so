'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title?: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

let globalConfirm: ((options: ConfirmOptions) => Promise<boolean>) | null = null

/** Use this instead of window.confirm() for a themed dialog */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (globalConfirm) return globalConfirm(options)
  // Fallback to native confirm if provider not mounted
  return Promise.resolve(window.confirm(options.description))
}

/** Mount this once in your layout to enable confirmDialog() */
export function ConfirmDialogProvider() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const handleConfirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setOptions(opts)
      setOpen(true)
    })
  }, [])

  // Register globally
  globalConfirm = handleConfirm

  function respond(value: boolean) {
    resolveRef.current?.(value)
    resolveRef.current = null
    setOpen(false)
  }

  const variant = options?.variant ?? 'destructive'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) respond(false) }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {variant === 'destructive' && (
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            )}
            <div>
              <DialogTitle>{options?.title ?? 'Xác nhận'}</DialogTitle>
              <DialogDescription className="mt-1">
                {options?.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => respond(false)}>
            {options?.cancelText ?? 'Hủy'}
          </Button>
          <Button
            variant={variant}
            onClick={() => respond(true)}
            autoFocus
          >
            {options?.confirmText ?? 'Xác nhận'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
