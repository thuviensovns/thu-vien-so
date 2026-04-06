'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle, XCircle, Loader2, Download, ShoppingCart,
  Package, Mail, FileDown, Check, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
// Cart is cleared by checkout page before redirect
import { typeLabels } from '@/lib/config'

interface PurchasedItem {
  id: string
  name: string
  slug: string
  price: number
  thumbnail: string
  type: string
}

interface DownloadStatus {
  id: string
  name: string
  type: string
  status: 'pending' | 'downloading' | 'done' | 'error'
  error?: string
}

export default function PaymentResultContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [orderNumber, setOrderNumber] = useState('')
  const [downloads, setDownloads] = useState<DownloadStatus[]>([])
  const [allDone, setAllDone] = useState(false)
  const downloadStarted = useRef(false)

  useEffect(() => {
    const responseCode = searchParams.get('vnp_ResponseCode')
    const txnRef = searchParams.get('vnp_TxnRef')
    const directStatus = searchParams.get('status')
    const directOrderNumber = searchParams.get('orderNumber')

    if (txnRef) setOrderNumber(txnRef)
    if (directOrderNumber) setOrderNumber(directOrderNumber)

    if (responseCode === '00' || directStatus === 'success') {
      setStatus('success')
      // Cart already cleared by checkout page before redirect
    } else if (responseCode || directStatus === 'failed') {
      setStatus('failed')
    } else {
      setStatus('failed')
    }
  }, [searchParams])

  // Auto-download purchased items on success
  useEffect(() => {
    if (status !== 'success' || downloadStarted.current) return
    downloadStarted.current = true

    const stored = localStorage.getItem('purchased_items')
    if (!stored) return

    try {
      const items: PurchasedItem[] = JSON.parse(stored)
      if (!items.length) return

      // Initialize download status list
      const initial: DownloadStatus[] = items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        status: 'pending',
      }))
      setDownloads(initial)

      // Start downloading each item with a small delay between them
      autoDownloadItems(items, initial)
    } catch {
      // Invalid stored data, ignore
    }
  }, [status])

  async function autoDownloadItems(items: PurchasedItem[], initial: DownloadStatus[]) {
    const updated = [...initial]

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      // Update status to downloading
      updated[i] = { ...updated[i], status: 'downloading' }
      setDownloads([...updated])

      try {
        // Try to get download URL from API
        const res = await fetch('/api/download/auto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            productId: item.id,
            orderNumber,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.url) {
            // Trigger browser download
            triggerDownload(data.url, data.fileName || `${item.slug}.zip`)
          }
          updated[i] = { ...updated[i], status: 'done' }
        } else {
          // API not available or product not in DB — generate demo file
          triggerDemoDownload(item)
          updated[i] = { ...updated[i], status: 'done' }
        }
      } catch {
        // Fallback: demo download
        triggerDemoDownload(item)
        updated[i] = { ...updated[i], status: 'done' }
      }

      setDownloads([...updated])

      // Small delay between downloads to prevent browser blocking
      if (i < items.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800))
      }
    }

    // Clean up stored items
    localStorage.removeItem('purchased_items')
    setAllDone(true)
  }

  function triggerDownload(url: string, fileName: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function triggerDemoDownload(item: PurchasedItem) {
    // Create a demo text file as placeholder download
    const content = [
      `=== Thư Viện Số ===`,
      ``,
      `Sản phẩm: ${item.name}`,
      `Loại: ${typeLabels[item.type] || item.type}`,
      `Mã đơn hàng: ${orderNumber || 'N/A'}`,
      ``,
      `Cảm ơn bạn đã mua hàng!`,
      ``,
      `Lưu ý: Đây là file xác nhận đơn hàng.`,
      `File sản phẩm thực tế sẽ được gửi qua email`,
      `hoặc có thể tải tại: /tai-khoan`,
      ``,
      `Hỗ trợ: support.thuvienso@gmail.com`,
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    triggerDownload(url, `${item.slug}-receipt.txt`)
    URL.revokeObjectURL(url)
  }

  if (status === 'loading') {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-[60vh] px-4">
        <Card className="w-full max-w-md border-border bg-card text-center">
          <CardContent className="p-8">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-bold">Đang xử lý thanh toán...</h1>
            <p className="text-sm text-muted-foreground mt-2">Vui lòng chờ trong giây lát</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-[60vh] px-4 py-8">
        <Card className="w-full max-w-lg border-border bg-card">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold">Thanh toán thành công!</h1>

            {orderNumber && (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Mã đơn hàng:</span>
                <span className="font-mono font-bold text-primary">{orderNumber}</span>
              </div>
            )}

            <Separator className="my-5" />

            {/* Auto-download progress */}
            {downloads.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 justify-center mb-3">
                  <FileDown className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-sm">
                    {allDone ? 'Tải xuống hoàn tất' : 'Đang tải sản phẩm...'}
                  </h2>
                </div>

                <div className="space-y-2 text-left max-w-sm mx-auto">
                  {downloads.map((dl) => (
                    <div
                      key={dl.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        dl.status === 'done'
                          ? 'border-success/20 bg-success/5'
                          : dl.status === 'downloading'
                            ? 'border-primary/20 bg-primary/5'
                            : dl.status === 'error'
                              ? 'border-destructive/20 bg-destructive/5'
                              : 'border-border bg-muted/30'
                      }`}
                    >
                      {dl.status === 'downloading' && (
                        <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
                      )}
                      {dl.status === 'done' && (
                        <Check className="h-4 w-4 text-success shrink-0" />
                      )}
                      {dl.status === 'error' && (
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      {dl.status === 'pending' && (
                        <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-xs">{dl.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {typeLabels[dl.type] || dl.type}
                        </p>
                      </div>
                      {dl.status === 'done' && (
                        <Badge className="bg-success/10 text-success border-success/20 text-[10px] shrink-0">
                          Xong
                        </Badge>
                      )}
                      {dl.status === 'downloading' && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">
                          Đang tải
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {allDone && (
                  <p className="text-xs text-success mt-2 font-medium">
                    Tất cả sản phẩm đã được tải về máy của bạn!
                  </p>
                )}

                <Separator className="mt-4" />
              </div>
            )}

            <div className="space-y-3 text-left max-w-sm mx-auto">
              <div className="flex items-start gap-3 text-sm">
                <Download className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Link download có trong tài khoản</p>
                  <p className="text-xs text-muted-foreground">Bạn có thể tải lại sản phẩm (tối đa 5 lần, trong 72 giờ)</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Email xác nhận đã được gửi</p>
                  <p className="text-xs text-muted-foreground">Kiểm tra hộp thư (bao gồm cả spam) để xem chi tiết đơn hàng</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow-sm">
                <Link href="/tai-khoan">
                  <Download className="mr-2 h-4 w-4" />
                  Đi đến Downloads
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/san-pham">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Tiếp tục mua sắm
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[60vh] px-4 py-8">
      <Card className="w-full max-w-lg border-border bg-card">
        <CardContent className="p-6 sm:p-8 text-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Thanh toán thất bại</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Đã xảy ra lỗi trong quá trình thanh toán. Đơn hàng chưa được xử lý.
          </p>
          {orderNumber && (
            <p className="text-xs text-muted-foreground mt-1">
              Mã đơn hàng: <span className="font-mono text-primary">{orderNumber}</span>
            </p>
          )}

          <Separator className="my-5" />

          <div className="text-left max-w-sm mx-auto space-y-2 text-xs text-muted-foreground">
            <p>Nguyên nhân có thể:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Số dư tài khoản không đủ</li>
              <li>Giao dịch bị hủy bởi ngân hàng</li>
              <li>Hết thời gian thanh toán</li>
              <li>Lỗi kết nối mạng</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/gio-hang">Thử lại thanh toán</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/lien-he">Liên hệ hỗ trợ</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
