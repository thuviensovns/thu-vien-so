'use client'

import { useState } from 'react'
import Image from 'next/image'
import { QrCode, Copy, Check } from 'lucide-react'
import { formatVND } from '@/lib/format'
import { toast } from 'sonner'
import type { BankAccount } from '@/lib/config'

interface BankTransferQRProps {
  qrUrl: string
  bank: BankAccount
  finalTotal: number
  transferContent: string
}

export default function BankTransferQR({ qrUrl, bank, finalTotal, transferContent }: BankTransferQRProps) {
  const [copied, setCopied] = useState<string | null>(null)

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      toast.success('Đã sao chép!')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Không thể sao chép')
    }
  }

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button
      type="button"
      onClick={() => copyToClipboard(text, id)}
      className="p-1 rounded hover:bg-muted/50 transition-colors"
    >
      {copied === id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  )

  return (
    <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
        <div className="shrink-0 bg-white rounded-lg p-2 shadow-sm">
          <Image src={qrUrl} alt="QR Code chuyển khoản" width={200} height={200} className="rounded" unoptimized />
        </div>

        <div className="flex-1 space-y-2.5 text-sm w-full">
          <h3 className="font-bold text-base flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            Thông tin chuyển khoản
          </h3>

          <div className="space-y-2">
            {[
              { label: 'Ngân hàng', value: bank.bankName },
              { label: 'Số tài khoản', value: bank.accountNumber, mono: true, primary: true, copyId: 'stk' },
              { label: 'Chủ tài khoản', value: bank.accountName },
              { label: 'Số tiền', value: formatVND(finalTotal), primary: true },
              { label: 'Nội dung CK', value: transferContent, mono: true, secondary: true, copyId: 'content' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                <span className="text-muted-foreground text-xs">{row.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`${row.mono ? 'font-mono' : ''} ${row.primary ? 'font-bold text-primary' : row.secondary ? 'font-mono font-bold text-secondary' : 'font-semibold'}`}>
                    {row.value}
                  </span>
                  {row.copyId && <CopyButton text={String(row.value)} id={row.copyId} />}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
            Quét mã QR bằng app ngân hàng hoặc chuyển khoản thủ công với nội dung trên.
            Đơn hàng sẽ được xử lý sau khi nhận được tiền.
          </p>
        </div>
      </div>
    </div>
  )
}
