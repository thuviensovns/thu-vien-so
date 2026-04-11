'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle, XCircle, Loader2, Download, ShoppingCart,
  Package, FileDown, Check, AlertTriangle, Clock, RefreshCw, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { typeLabels } from '@/lib/config'

interface DownloadItem {
  productId: string
  name: string
  hasFile: boolean
  fileName: string | null
  fileSize: number | null
  fileFormat: string | null
}

interface DownloadStatus extends DownloadItem {
  status: 'pending' | 'downloading' | 'done' | 'error'
  error?: string
  url?: string
}

export default function PaymentResultContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading')
  const [orderNumber, setOrderNumber] = useState('')
  const [downloadToken, setDownloadToken] = useState('')
  const [downloads, setDownloads] = useState<DownloadStatus[]>([])
  const [allDone, setAllDone] = useState(false)
  const [polling, setPolling] = useState(false)
  const downloadStarted = useRef(false)
  const downloadFrameRef = useRef<HTMLIFrameElement | null>(null)

  // Determine payment result from URL params
  useEffect(() => {
    const responseCode = searchParams.get('vnp_ResponseCode')
    const txnRef = searchParams.get('vnp_TxnRef')
    const directStatus = searchParams.get('status')
    const directOrderNumber = searchParams.get('orderNumber')
    const token = searchParams.get('token')

    if (txnRef) setOrderNumber(txnRef)
    if (directOrderNumber) setOrderNumber(directOrderNumber)
    if (token) setDownloadToken(token)

    if (responseCode === '00' || directStatus === 'success') {
      setStatus('success')
    } else if (directStatus === 'pending') {
      setStatus('pending')
    } else if (responseCode || directStatus === 'failed') {
      setStatus('failed')
    } else {
      setStatus('failed')
    }
  }, [searchParams])

  // For VNPay: webhook may fire after redirect — poll for download token
  const pollForToken = useCallback(async (on: string) => {
    if (!on) return
    setPolling(true)
    for (let i = 0; i < 10; i++) {
      try {
        const res = await fetch(`/api/orders/by-number?orderNumber=${encodeURIComponent(on)}`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.downloadToken) {
            setDownloadToken(data.downloadToken)
            setPolling(false)
            return data.downloadToken
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 2000))
    }
    setPolling(false)
    return null
  }, [])

  // Auto-download when we have a token
  useEffect(() => {
    if (status !== 'success' || downloadStarted.current) return

    async function startDownloads() {
      let token = downloadToken

      // If no token yet (VNPay redirect), poll for it
      if (!token && orderNumber) {
        token = await pollForToken(orderNumber) || ''
      }

      if (!token) return
      downloadStarted.current = true

      // Fetch downloadable items from the token endpoint
      try {
        const res = await fetch(`/api/download/${token}`)
        if (!res.ok) return
        const data = await res.json()

        if (!data.items?.length) return

        const statuses: DownloadStatus[] = data.items.map((item: DownloadItem) => ({
          ...item,
          status: 'pending' as const,
        }))
        setDownloads(statuses)

        // Download each item
        for (let i = 0; i < statuses.length; i++) {
          statuses[i] = { ...statuses[i], status: 'downloading' }
          setDownloads([...statuses])

          try {
            if (!statuses[i].hasFile) {
              statuses[i] = { ...statuses[i], status: 'error', error: 'Chưa có file' }
              setDownloads([...statuses])
              continue
            }

            const dlRes = await fetch(`/api/download/${token}?productId=${statuses[i].productId}`)
            if (dlRes.ok) {
              const dlData = await dlRes.json()
              if (dlData.url) {
                // Only the first item auto-triggers via iframe — chained iframe
                // navigations hit popup-blocker heuristics too. Remaining files
                // surface as "Tải" buttons (user gesture = always allowed).
                if (i === 0) triggerDownload(dlData.url)
                statuses[i] = { ...statuses[i], status: 'done', url: dlData.url }
              } else {
                statuses[i] = { ...statuses[i], status: 'error', error: 'Không có URL' }
              }
            } else {
              const err = await dlRes.json().catch(() => ({}))
              statuses[i] = { ...statuses[i], status: 'error', error: err.error || 'Lỗi tải' }
            }
          } catch {
            statuses[i] = { ...statuses[i], status: 'error', error: 'Lỗi kết nối' }
          }

          setDownloads([...statuses])
        }

        setAllDone(true)
      } catch (e) {
        console.error('[PaymentResult] Download error:', e)
      }
    }

    startDownloads()
  }, [status, downloadToken, orderNumber, pollForToken])

  // Hidden-iframe navigation — Google Drive's `uc?export=download` URL returns
  // Content-Disposition: attachment, so the browser starts a file download and
  // the iframe stays blank. This bypasses the popup blocker entirely because
  // no window.open / target=_blank is involved.
  function triggerDownload(url: string) {
    if (!downloadFrameRef.current) return
    downloadFrameRef.current.src = url
  }

  // Manual click handler — user gesture, so cross-origin downloads always work.
  function manualDownload(url: string, fileName: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.rel = 'noopener noreferrer'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function retryDownload(index: number) {
    if (!downloadToken) return
    const updated = [...downloads]
    updated[index] = { ...updated[index], status: 'downloading', error: undefined }
    setDownloads(updated)

    try {
      const res = await fetch(`/api/download/${downloadToken}?productId=${updated[index].productId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          // Retry IS a user-gesture click — use manualDownload (honours filename).
          manualDownload(data.url, data.fileName || `${updated[index].name}.zip`)
          updated[index] = { ...updated[index], status: 'done', url: data.url }
        } else {
          updated[index] = { ...updated[index], status: 'error', error: 'Không có URL' }
        }
      } else {
        const err = await res.json().catch(() => ({}))
        updated[index] = { ...updated[index], status: 'error', error: err.error || 'Lỗi tải' }
      }
    } catch {
      updated[index] = { ...updated[index], status: 'error', error: 'Lỗi kết nối' }
    }
    setDownloads([...updated])
  }

  // --- LOADING ---
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

  // --- PENDING (bank transfer) ---
  if (status === 'pending') {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-[60vh] px-4 py-8">
        <Card className="w-full max-w-lg border-border bg-card">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="h-20 w-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-10 w-10 text-warning" />
            </div>
            <h1 className="text-2xl font-bold">Chờ xác nhận thanh toán</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Sau khi chuyển khoản, hệ thống sẽ tự động xác nhận trong 1-5 phút.
            </p>

            {orderNumber && (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Mã đơn hàng:</span>
                <span className="font-mono font-bold text-primary">{orderNumber}</span>
              </div>
            )}

            <Separator className="my-5" />

            <div className="text-left max-w-sm mx-auto space-y-2 text-xs text-muted-foreground">
              <p>Nội dung chuyển khoản phải chứa mã đơn hàng <span className="font-mono text-primary font-bold">{orderNumber}</span> để hệ thống tự động xác nhận.</p>
              <p>Sau khi xác nhận, bạn sẽ nhận được link tải sản phẩm tại trang <strong>Tài khoản</strong>.</p>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button asChild size="lg">
                <Link href="/tai-khoan">Kiểm tra tài khoản</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/san-pham">Tiếp tục mua sắm</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- SUCCESS ---
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

            {/* Polling indicator */}
            {polling && (
              <div className="flex items-center justify-center gap-2 mb-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang chờ xác nhận từ cổng thanh toán...
              </div>
            )}

            {/* Download progress */}
            {downloads.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 justify-center mb-3">
                  <FileDown className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-sm">
                    {allDone ? 'Sẵn sàng tải xuống' : 'Đang chuẩn bị tải...'}
                  </h2>
                </div>

                <div className="flex items-start gap-2 p-3 mb-3 rounded-lg border border-primary/20 bg-primary/5 text-left max-w-sm mx-auto">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Nếu trình duyệt chặn tải xuống, vui lòng nhấn nút <strong className="text-primary">Tải</strong> bên cạnh mỗi sản phẩm. Cho phép pop-up từ trang web để file tự tải lần sau.
                  </p>
                </div>

                <div className="space-y-2 text-left max-w-sm mx-auto">
                  {downloads.map((dl, idx) => (
                    <div
                      key={dl.productId}
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
                      {dl.status === 'downloading' && <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />}
                      {dl.status === 'done' && <Check className="h-4 w-4 text-success shrink-0" />}
                      {dl.status === 'error' && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                      {dl.status === 'pending' && <Download className="h-4 w-4 text-muted-foreground shrink-0" />}

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-xs">{dl.name}</p>
                        {dl.fileFormat && (
                          <p className="text-[10px] text-muted-foreground">{dl.fileFormat.toUpperCase()}{dl.fileSize ? ` • ${(dl.fileSize / 1048576).toFixed(1)}MB` : ''}</p>
                        )}
                        {dl.error && <p className="text-[10px] text-destructive">{dl.error}</p>}
                      </div>

                      {dl.status === 'done' && dl.url && (
                        <button
                          onClick={() => manualDownload(dl.url!, dl.fileName || `${dl.name}.zip`)}
                          className="text-[10px] px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 shrink-0 font-medium"
                        >
                          <Download className="h-3 w-3" /> Tải
                        </button>
                      )}
                      {dl.status === 'downloading' && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">Đang tải</Badge>
                      )}
                      {dl.status === 'error' && (
                        <button onClick={() => retryDownload(idx)} className="text-[10px] text-primary hover:underline flex items-center gap-1 shrink-0">
                          <RefreshCw className="h-3 w-3" /> Thử lại
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {allDone && (
                  <p className="text-xs text-success mt-2 font-medium">
                    Nhấn nút Tải để lưu từng sản phẩm về máy.
                  </p>
                )}

                <iframe
                  ref={downloadFrameRef}
                  className="hidden"
                  title="download-frame"
                  aria-hidden="true"
                />

                <Separator className="mt-4" />
              </div>
            )}

            <div className="space-y-3 text-left max-w-sm mx-auto">
              <div className="flex items-start gap-3 text-sm">
                <Download className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Tải lại sản phẩm</p>
                  <p className="text-xs text-muted-foreground">
                    {downloadToken
                      ? 'Bạn có thể tải lại bằng link bên dưới (có hiệu lực 72 giờ)'
                      : 'Link tải có trong trang Tài khoản'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              {downloadToken && (
                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow-sm">
                  <Link href={`/tai-khoan?tab=downloads&token=${downloadToken}`}>
                    <Download className="mr-2 h-4 w-4" />
                    Trang Downloads
                  </Link>
                </Button>
              )}
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

  // --- FAILED ---
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
