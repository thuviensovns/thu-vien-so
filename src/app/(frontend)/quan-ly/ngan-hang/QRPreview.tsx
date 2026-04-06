'use client'

import { useState } from 'react'
import Image from 'next/image'
import { QrCode, Eye, Copy, Check, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatVND } from '@/lib/format'
import { MIN_TOPUP, type BankAccount } from '@/lib/config'
import { toast } from 'sonner'

interface QRPreviewProps {
  form: BankAccount
  previewQr: string
}

export default function QRPreview({ form, previewQr }: QRPreviewProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key); toast.success('Đã sao chép!')
      setTimeout(() => setCopied(null), 2000)
    } catch { toast.error('Không thể sao chép') }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <QrCode className="h-4 w-4 text-primary" />Xem trước QR
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)} className="text-xs">
              <Eye className="mr-1 h-3 w-3" />{showPreview ? 'Ẩn' : 'Hiện'}
            </Button>
          </div>

          {showPreview && form.bankBin && form.accountNumber && (
            <div className="rounded-xl overflow-hidden border border-border bg-white">
              <Image src={previewQr} alt="QR Preview" width={280} height={280} className="w-full h-auto" unoptimized />
            </div>
          )}

          <div className="space-y-1.5 text-xs">
            {[
              { label: 'Ngân hàng', value: form.bankName },
              { label: 'BIN', value: form.bankBin, mono: true },
              { label: 'STK', value: form.accountNumber, mono: true, primary: true, copyKey: 'preview-stk' },
              { label: 'Tên', value: form.accountName },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-muted-foreground">{row.label}</span>
                <div className="flex items-center gap-1">
                  <span className={`${row.mono ? 'font-mono' : ''} ${row.primary ? 'font-bold text-primary' : 'font-medium'} truncate ml-2`}>
                    {row.value || '—'}
                  </span>
                  {row.copyKey && row.value && (
                    <button onClick={() => copyText(row.value!, row.copyKey!)} className="p-0.5 rounded hover:bg-muted/50">
                      {copied === row.copyKey ? <Check className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-success/20 bg-success/5">
        <CardContent className="p-3">
          <h4 className="text-xs font-bold text-success mb-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />Đang sử dụng
          </h4>
          <div className="space-y-1 text-[11px]">
            <p><span className="text-muted-foreground">Ngân hàng:</span> <span className="font-medium">{form.bankName}</span></p>
            <p><span className="text-muted-foreground">STK:</span> <span className="font-mono font-bold">{form.accountNumber}</span></p>
            <p><span className="text-muted-foreground">Tên:</span> <span className="font-medium">{form.accountName}</span></p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-warning/20 bg-warning/5">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-warning mb-1">Lưu ý</p>
            <p>Thay đổi áp dụng ngay cho trang thanh toán và nạp tiền. Nạp tối thiểu: {formatVND(MIN_TOPUP)}.</p>
            <p className="mt-1">Lưu nhiều hồ sơ để chuyển đổi nhanh giữa các tài khoản ngân hàng.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
