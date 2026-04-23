import Link from 'next/link'
import { Megaphone, Sparkles, Check, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { ReactNode } from 'react'

interface AutoConfirmNoticeProps {
  /** Override the default top-up title for checkout flows. */
  title?: string
  /** Override the default first bullet for checkout flows. */
  firstBullet?: ReactNode
  className?: string
}

/**
 * Green "auto-confirm 1-2 min" reassurance banner.
 * Shared between /nap-tien and /thanh-toan so the message never drifts
 * between the two bank-transfer entry points.
 */
export function PaymentAutoConfirmNotice({
  title = 'Tiền sẽ tự động vào tài khoản trong 1–2 phút sau khi chuyển khoản',
  firstBullet = (
    <span>
      Sau khi chuyển khoản, vui lòng <b className="text-foreground">chờ 1–2 phút</b>. Hệ thống tự động xác nhận và cộng tiền — bạn không cần thao tác gì thêm.
    </span>
  ),
  className = '',
}: AutoConfirmNoticeProps) {
  return (
    <Card className={`border-success/30 bg-gradient-to-br from-success/10 via-primary/5 to-success/5 overflow-hidden ${className}`}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex h-14 w-14 rounded-2xl bg-success/15 items-center justify-center shrink-0">
            <Megaphone className="h-7 w-7 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success text-white text-[10px] font-bold mb-2.5 tracking-wider uppercase shadow-sm">
              <Sparkles className="h-3 w-3" />
              Thông báo
            </div>
            <h3 className="text-base sm:text-lg font-bold text-foreground mb-3 leading-snug">
              {title}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3 text-success" />
                </div>
                {firstBullet}
              </li>
              <li className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3 text-success" />
                </div>
                <span>
                  Vui lòng <b className="text-foreground">giữ nguyên nội dung chuyển khoản</b> (NAPKH…) để hệ thống khớp đúng giao dịch của bạn.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3 text-success" />
                </div>
                <span>
                  Nếu quá 5 phút chưa thấy kết quả, vui lòng{' '}
                  <Link href="/lien-he" className="text-primary hover:underline font-medium">liên hệ hỗ trợ</Link>
                  {' '}để được xử lý nhanh.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Orange "disable popup blocker" notice shown on pages where downloads
 * auto-trigger. Tells users the browser's popup/window blocker must be
 * turned off in the address bar so files download without a manual click.
 */
export function PopupBlockerNotice({ className = '' }: { className?: string }) {
  return (
    <Card className={`border-warning/30 bg-gradient-to-br from-warning/10 via-primary/5 to-warning/5 overflow-hidden ${className}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="hidden sm:flex h-12 w-12 rounded-2xl bg-warning/15 items-center justify-center shrink-0">
            <Info className="h-6 w-6 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning text-white text-[10px] font-bold mb-2 tracking-wider uppercase shadow-sm">
              <Info className="h-3 w-3" />
              Lưu ý khi tải xuống
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              Trình duyệt có tính năng <b>tự động chặn mở cửa sổ mới</b>. Quý khách hãy{' '}
              <b className="text-warning">tắt tính năng đó đi ở thanh công cụ tìm kiếm góc phải</b>{' '}
              — khi đó file sẽ tự động được tải xuống.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
