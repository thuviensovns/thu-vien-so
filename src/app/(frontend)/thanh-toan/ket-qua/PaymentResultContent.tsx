'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle, XCircle, Loader2, Download, ShoppingCart,
  Package, FileDown, Check, AlertTriangle, Clock, RefreshCw, QrCode,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { typeLabels, buildVietQRUrl, buildMomoQRUrl } from '@/lib/config'
import { useBankConfig } from '@/hooks/use-bank-config'
import { PopupBlockerNotice } from '@/components/shared/PaymentNotices'
import BankTransferQR from '../BankTransferQR'
import { formatVND } from '@/lib/format'
import { readInstantBuyStash, clearInstantBuyStash, type InstantBuyDownloadItem } from '@/lib/instant-buy'

interface DownloadItem {
  productId: string
  name: string
  hasFile: boolean
  fileName: string | null
  fileSize: number | null
  fileFormat: string | null
  url?: string | null
}

interface DownloadStatus extends DownloadItem {
  status: 'pending' | 'downloading' | 'done' | 'error'
  error?: string
  url?: string
}

function itemsToStatuses(items: InstantBuyDownloadItem[] | DownloadItem[]): DownloadStatus[] {
  return items.map((item) => ({
    productId: String(item.productId),
    name: item.name,
    hasFile: item.hasFile,
    fileName: item.fileName,
    fileSize: item.fileSize,
    fileFormat: item.fileFormat,
    url: item.url || undefined,
    status: item.hasFile && item.url
      ? 'done'
      : item.hasFile
        ? 'error'
        : 'pending',
    error: !item.hasFile
      ? 'Chưa có file'
      : !item.url
        ? 'Không có URL'
        : undefined,
  }))
}

function deriveStatus(sp: URLSearchParams | ReturnType<typeof useSearchParams>): 'loading' | 'success' | 'failed' | 'pending' {
  const responseCode = sp.get('vnp_ResponseCode')
  const directStatus = sp.get('status')
  if (responseCode === '00' || directStatus === 'success') return 'success'
  if (directStatus === 'pending') return 'pending'
  if (responseCode || directStatus === 'failed') return 'failed'
  return 'failed'
}

export default function PaymentResultContent() {
  const searchParams = useSearchParams()
  const bank = useBankConfig()
  // Lazy init from URL params so we skip the "Đang xử lý thanh toán..." flash
  // on instant-buy redirects — the status is already known at mount time.
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>(
    () => deriveStatus(searchParams),
  )
  const [orderNumber, setOrderNumber] = useState(
    () => searchParams.get('orderNumber') || searchParams.get('vnp_TxnRef') || '',
  )
  const [downloadToken, setDownloadToken] = useState(() => searchParams.get('token') || '')
  const [transferCode, setTransferCode] = useState(() => searchParams.get('transferCode') || '')
  const [orderAmount, setOrderAmount] = useState(() => Number(searchParams.get('amount')) || 0)
  const [paymentMethod, setPaymentMethod] = useState<'bank-transfer' | 'momo' | ''>(() => {
    const m = searchParams.get('method')
    return m === 'bank-transfer' || m === 'momo' ? m : ''
  })
  // Lazy-read the instant-buy sessionStorage stash synchronously on first
  // render. If the user just clicked "Mua ngay", the signed download URLs
  // were stashed by the client before navigation — so "Tải" buttons render
  // on the FIRST paint with zero network round-trips.
  const initialStash = useMemo<DownloadStatus[] | null>(() => {
    if (typeof window === 'undefined') return null
    const token = searchParams.get('token')
    if (!token) return null
    const stash = readInstantBuyStash(token)
    if (!stash?.items?.length) return null
    return itemsToStatuses(stash.items)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [downloads, setDownloads] = useState<DownloadStatus[]>(initialStash || [])
  const [allDone, setAllDone] = useState(!!initialStash?.length)
  const [polling, setPolling] = useState(false)
  // If we hydrated from the stash, mark the fetch effect as already-done so it
  // doesn't also fire a redundant /api/download/[token] call.
  const downloadStarted = useRef(!!initialStash?.length)
  const downloadFrameRef = useRef<HTMLIFrameElement | null>(null)
  const autoTriggered = useRef(false)

  // Keep state in sync if params change after mount (back/forward nav, etc.)
  useEffect(() => {
    setStatus(deriveStatus(searchParams))
    const on = searchParams.get('orderNumber') || searchParams.get('vnp_TxnRef')
    if (on) setOrderNumber(on)
    const token = searchParams.get('token')
    if (token) setDownloadToken(token)
    const tCode = searchParams.get('transferCode')
    if (tCode) setTransferCode(tCode)
    const amountParam = searchParams.get('amount')
    if (amountParam) setOrderAmount(Number(amountParam) || 0)
    const methodParam = searchParams.get('method')
    if (methodParam === 'bank-transfer' || methodParam === 'momo') setPaymentMethod(methodParam)
  }, [searchParams])

  // Drop the sessionStorage stash once we've hydrated from it so a page
  // refresh doesn't serve stale URLs (signed R2 URLs expire in 1h anyway).
  useEffect(() => {
    if (initialStash && downloadToken) {
      clearInstantBuyStash(downloadToken)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-regenerated QR for pending bank-transfer / MoMo orders. Keeps the
  // /thanh-toan checkout QR alive after redirect so the user can still scan
  // if they haven't paid yet, or came back after navigating away.
  const pendingQrUrl = useMemo(() => {
    if (!orderAmount || !transferCode) return ''
    if (paymentMethod === 'momo') return buildMomoQRUrl(orderAmount, transferCode)
    return buildVietQRUrl(orderAmount, transferCode, bank)
  }, [orderAmount, transferCode, bank, paymentMethod])

  // For VNPay: webhook may fire after redirect — poll for download token.
  // Shorter/tighter interval than before so the success UI doesn't linger
  // waiting on a cold webhook. 5 × 1s ≈ covers the usual webhook lag.
  const pollForToken = useCallback(async (on: string) => {
    if (!on) return
    setPolling(true)
    for (let i = 0; i < 5; i++) {
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
      await new Promise((r) => setTimeout(r, 1000))
    }
    setPolling(false)
    return null
  }, [])

  // Fallback fetch for VNPay / direct URL visits where the sessionStorage
  // stash isn't populated. Instant-buy redirects skip this entirely because
  // downloadStarted is already true from the lazy-init stash read above.
  useEffect(() => {
    if (status !== 'success' || downloadStarted.current) return

    async function startDownloads() {
      let token = downloadToken
      if (!token && orderNumber) {
        token = await pollForToken(orderNumber) || ''
      }
      if (!token) return
      downloadStarted.current = true

      try {
        const res = await fetch(`/api/download/${token}`)
        if (!res.ok) return
        const data = await res.json()
        if (!data.items?.length) return

        setDownloads(itemsToStatuses(data.items))
        setAllDone(true)
      } catch (e) {
        console.error('[PaymentResult] Download error:', e)
      }
    }

    startDownloads()
  }, [status, downloadToken, orderNumber, pollForToken])

  // Auto-trigger first download via hidden iframe. Runs AFTER React commits
  // (post-render) so the iframe ref is guaranteed attached — fixes the old
  // race where triggerDownload fired synchronously after setDownloads before
  // the iframe had mounted.
  useEffect(() => {
    if (autoTriggered.current) return
    if (status !== 'success') return
    if (downloads.length === 0) return
    const first = downloads.find((d) => d.status === 'done' && d.url)
    if (!first?.url) return
    autoTriggered.current = true
    triggerDownload(first.url)
  }, [status, downloads])

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

  // --- PENDING (bank transfer / MoMo) ---
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
              Sau khi chuyển khoản, hệ thống sẽ tự động xác nhận trong 1-2 phút.
            </p>

            {orderNumber && (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Mã đơn hàng:</span>
                <span className="font-mono font-bold text-primary">{orderNumber}</span>
              </div>
            )}

            {/* Auto-regenerated QR — same bank config + transfer code the user
                saw on /thanh-toan. Survives redirect, refresh, and revisit. */}
            {pendingQrUrl && paymentMethod === 'bank-transfer' && (
              <div className="mt-5">
                <BankTransferQR
                  qrUrl={pendingQrUrl}
                  bank={bank}
                  finalTotal={orderAmount}
                  transferContent={transferCode}
                />
              </div>
            )}

            {pendingQrUrl && paymentMethod === 'momo' && (
              <div className="mt-5 p-4 rounded-xl border border-pink-500/20 bg-pink-500/5 text-left">
                <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                  <div className="shrink-0 bg-white rounded-lg p-2 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pendingQrUrl} alt="QR MoMo" width={200} height={200} className="rounded" />
                  </div>
                  <div className="flex-1 space-y-2 text-sm w-full">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-pink-500" />
                      Thanh toán qua MoMo
                    </h3>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                      <span className="text-muted-foreground text-xs">Số tiền</span>
                      <span className="font-bold text-pink-500">{formatVND(orderAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                      <span className="text-muted-foreground text-xs">Nội dung CK</span>
                      <span className="font-mono font-bold text-secondary">{transferCode}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fallback — no amount in URL (older link or direct visit): keep
                the text-only panel so users aren't left blank. */}
            {!pendingQrUrl && transferCode && (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/5 border border-primary/20">
                <QrCode className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Nội dung CK:</span>
                <span className="font-mono font-bold text-secondary">{transferCode}</span>
              </div>
            )}

            <Separator className="my-5" />

            <div className="text-left max-w-sm mx-auto space-y-2 text-xs text-muted-foreground">
              <p>Nội dung chuyển khoản phải chứa mã <span className="font-mono text-secondary font-bold">{transferCode || orderNumber}</span> để hệ thống tự động xác nhận.</p>
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

                <div className="max-w-md mx-auto mb-4 text-left">
                  <PopupBlockerNotice />
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
