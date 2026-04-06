import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Scale } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { siteConfig } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng — Thư Viện Số',
  description: 'Điều khoản sử dụng dịch vụ của Thư Viện Số, tuân thủ pháp luật Việt Nam.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="container relative mx-auto px-4 py-10 sm:py-14 text-center">
          <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary border-primary/20 text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Pháp lý
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Điều khoản sử dụng</h1>
          <p className="mt-2 text-sm text-muted-foreground">Cập nhật lần cuối: 06/04/2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <article className="max-w-3xl mx-auto">
          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

            {/* Mở đầu */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-foreground mb-1.5">
                <Scale className="h-3.5 w-3.5" />
                Căn cứ pháp lý
              </p>
              <p>
                Điều khoản này được xây dựng căn cứ theo Bộ luật Dân sự 2015; Luật Thương mại 2005;
                Luật Giao dịch điện tử 2023 (số 20/2023/QH15); Luật Bảo vệ quyền lợi người tiêu dùng 2023
                (số 19/2023/QH15); Nghị định 52/2013/NĐ-CP và Nghị định 85/2021/NĐ-CP về thương mại điện tử;
                Luật Sở hữu trí tuệ 2005 (sửa đổi, bổ sung 2009, 2019, 2022).
              </p>
            </div>

            {/* Điều 1 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 1. Thông tin chủ thể cung cấp dịch vụ</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Tên nền tảng:</strong> {siteConfig.name}</li>
                <li><strong className="text-foreground">Loại hình:</strong> Nền tảng thương mại điện tử cung cấp sản phẩm số (tài nguyên sản xuất âm nhạc)</li>
                <li><strong className="text-foreground">Email liên hệ:</strong>{' '}
                  <a href={`mailto:${siteConfig.contact.email}`} className="text-primary hover:underline">{siteConfig.contact.email}</a>
                </li>
                <li><strong className="text-foreground">Số điện thoại:</strong> {siteConfig.contact.phone}</li>
                <li><strong className="text-foreground">Lĩnh vực hoạt động:</strong> Cung cấp Sample Pack, FLP Project, VST Plugin, Preset, Instrument và các tài nguyên âm nhạc số</li>
              </ul>
            </section>

            {/* Điều 2 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 2. Phạm vi và đối tượng áp dụng</h2>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Điều khoản này áp dụng cho tất cả người dùng truy cập, đăng ký tài khoản và sử dụng dịch vụ trên nền tảng {siteConfig.name}.</li>
                <li>Bằng việc đăng ký tài khoản hoặc sử dụng dịch vụ, người dùng xác nhận đã đọc, hiểu và đồng ý tuân thủ toàn bộ Điều khoản sử dụng này.</li>
                <li>Người dùng dưới 16 tuổi cần có sự đồng ý của cha, mẹ hoặc người giám hộ hợp pháp theo quy định tại Nghị định 13/2023/NĐ-CP.</li>
              </ol>
            </section>

            {/* Điều 3 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 3. Tài khoản người dùng</h2>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Người dùng phải cung cấp thông tin chính xác, đầy đủ khi đăng ký tài khoản theo quy định tại Điều 9 Luật Giao dịch điện tử 2023.</li>
                <li>Người dùng chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động phát sinh từ tài khoản của mình.</li>
                <li>Mỗi tài khoản chỉ được sử dụng bởi một cá nhân. Nghiêm cấm chia sẻ, mua bán hoặc chuyển nhượng tài khoản.</li>
                <li>
                  Chúng tôi có quyền tạm khóa hoặc chấm dứt tài khoản trong các trường hợp: vi phạm Điều khoản sử dụng,
                  sử dụng dịch vụ vào mục đích vi phạm pháp luật, hoặc có hành vi gian lận.
                  Trước khi khóa tài khoản, chúng tôi sẽ <strong className="text-foreground">thông báo cho người dùng qua email</strong> và
                  nêu rõ lý do, trừ trường hợp vi phạm nghiêm trọng cần xử lý khẩn cấp theo yêu cầu cơ quan có thẩm quyền.
                </li>
                <li>Người dùng có quyền yêu cầu xóa tài khoản bất cứ lúc nào bằng cách liên hệ qua email hoặc trang Liên hệ. Tài khoản sẽ được xóa trong vòng 30 ngày làm việc.</li>
              </ol>
            </section>

            {/* Điều 4 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 4. Sản phẩm và giấy phép sử dụng</h2>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Quyền sở hữu trí tuệ:</strong> Toàn bộ sản phẩm trên nền tảng được bảo hộ
                  theo Luật Sở hữu trí tuệ 2005 (sửa đổi 2022). Người dùng mua sản phẩm được cấp
                  <strong className="text-foreground"> quyền sử dụng có giới hạn (license)</strong>, không phải quyền sở hữu.
                </li>
                <li>
                  <strong className="text-foreground">Phạm vi giấy phép:</strong>
                  <ul className="list-disc pl-5 mt-1.5 space-y-1">
                    <li>Được sử dụng trong sản phẩm âm nhạc cá nhân và thương mại (bài hát, beat, nhạc nền).</li>
                    <li>Được sử dụng trên không giới hạn dự án âm nhạc.</li>
                    <li><strong className="text-foreground">Không được</strong> phân phối lại, bán lại, chia sẻ hoặc cho tải lại file gốc dưới bất kỳ hình thức nào.</li>
                    <li><strong className="text-foreground">Không được</strong> sử dụng sản phẩm để tạo sản phẩm cạnh tranh trực tiếp (ví dụ: đóng gói lại thành sample pack khác).</li>
                  </ul>
                </li>
                <li>Sản phẩm miễn phí cũng tuân theo điều khoản giấy phép tương tự, trừ khi có ghi chú riêng trên trang sản phẩm.</li>
                <li>Mỗi lần mua cho phép tải tối đa 5 lần trong vòng 72 giờ. Sau thời hạn này, người dùng có thể liên hệ hỗ trợ để được cấp lại quyền tải.</li>
              </ol>
            </section>

            {/* Điều 5 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 5. Giá cả và thanh toán</h2>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Giá sản phẩm được niêm yết bằng Việt Nam Đồng (VND), là giá cuối cùng người dùng phải thanh toán.</li>
                <li>Các phương thức thanh toán được hỗ trợ: chuyển khoản ngân hàng qua QR code, VNPay, MoMo.</li>
                <li>Thanh toán được xử lý qua các cổng thanh toán có giấy phép hoạt động tại Việt Nam. {siteConfig.name} không lưu trữ thông tin thẻ ngân hàng của người dùng.</li>
                <li>Hóa đơn điện tử (nếu có) sẽ được gửi qua email đăng ký theo quy định pháp luật về hóa đơn điện tử.</li>
              </ol>
            </section>

            {/* Điều 6 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 6. Chính sách hoàn tiền</h2>
              <p className="mb-2">
                Căn cứ Điều 25, Luật Bảo vệ quyền lợi người tiêu dùng 2023 và đặc thù sản phẩm số không thể thu hồi sau khi tải về:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Được hoàn tiền</strong> trong các trường hợp:
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Sản phẩm bị lỗi kỹ thuật không thể sử dụng được (file hỏng, không giải nén được, nội dung không đúng mô tả).</li>
                    <li>Lỗi hệ thống dẫn đến trừ tiền nhưng không nhận được sản phẩm.</li>
                    <li>Trùng lặp thanh toán do lỗi kỹ thuật.</li>
                  </ul>
                </li>
                <li>
                  <strong className="text-foreground">Không hoàn tiền</strong> trong các trường hợp:
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Sản phẩm đã tải về thành công và hoạt động bình thường.</li>
                    <li>Người dùng thay đổi ý định sau khi đã tải.</li>
                    <li>Sản phẩm không tương thích với phần mềm của người dùng (thông tin tương thích được ghi rõ trên trang sản phẩm).</li>
                  </ul>
                </li>
                <li>Yêu cầu hoàn tiền phải được gửi trong vòng <strong className="text-foreground">48 giờ</strong> kể từ thời điểm mua, kèm mô tả lỗi chi tiết.</li>
                <li>Hoàn tiền sẽ được xử lý trong vòng <strong className="text-foreground">7–15 ngày làm việc</strong> qua phương thức thanh toán ban đầu.</li>
              </ol>
            </section>

            {/* Điều 7 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 7. Quyền và nghĩa vụ của người dùng</h2>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-foreground mb-1.5">7.1. Quyền của người dùng:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Được cung cấp thông tin đầy đủ, chính xác về sản phẩm trước khi mua theo Điều 4 Luật Bảo vệ quyền lợi người tiêu dùng 2023.</li>
                    <li>Được bảo vệ thông tin cá nhân theo Nghị định 13/2023/NĐ-CP.</li>
                    <li>Được khiếu nại, khiếu kiện theo quy định pháp luật khi quyền lợi bị xâm phạm.</li>
                    <li>Được yêu cầu hoàn tiền khi sản phẩm bị lỗi theo Điều 6 của Điều khoản này.</li>
                    <li>Được yêu cầu xóa tài khoản và dữ liệu cá nhân.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1.5">7.2. Nghĩa vụ của người dùng:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Cung cấp thông tin chính xác, không sử dụng thông tin giả mạo.</li>
                    <li>Tuân thủ giấy phép sử dụng sản phẩm quy định tại Điều 4.</li>
                    <li>Không sử dụng dịch vụ vào mục đích vi phạm pháp luật Việt Nam.</li>
                    <li>Không can thiệp, phá hoại hoặc gây ảnh hưởng đến hoạt động bình thường của hệ thống.</li>
                    <li>Tôn trọng quyền sở hữu trí tuệ của bên thứ ba.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Điều 8 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 8. Quyền và nghĩa vụ của {siteConfig.name}</h2>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-foreground mb-1.5">8.1. Quyền:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Thay đổi giá sản phẩm, nội dung dịch vụ với thông báo trước trên nền tảng.</li>
                    <li>Tạm khóa hoặc chấm dứt tài khoản vi phạm theo quy trình tại Điều 3.4.</li>
                    <li>Gỡ bỏ nội dung vi phạm quyền sở hữu trí tuệ trong vòng 24 giờ kể từ khi nhận được thông báo hợp lệ.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1.5">8.2. Nghĩa vụ:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Cung cấp thông tin sản phẩm chính xác, đầy đủ theo Nghị định 85/2021/NĐ-CP.</li>
                    <li>Bảo vệ thông tin cá nhân người dùng theo Nghị định 13/2023/NĐ-CP.</li>
                    <li>Xử lý khiếu nại trong vòng 7–15 ngày làm việc kể từ khi nhận được yêu cầu.</li>
                    <li>Thông báo cho người dùng khi phát hiện sự cố bảo mật ảnh hưởng đến dữ liệu cá nhân trong vòng 72 giờ.</li>
                    <li>Đảm bảo hệ thống thanh toán hoạt động an toàn, ổn định.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Điều 9 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 9. Nội dung bị nghiêm cấm</h2>
              <p className="mb-2">Người dùng không được sử dụng nền tảng để:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Đăng tải, chia sẻ nội dung vi phạm pháp luật, trái đạo đức, thuần phong mỹ tục Việt Nam.</li>
                <li>Xúc phạm danh dự, nhân phẩm của tổ chức, cá nhân.</li>
                <li>Tuyên truyền, kích động bạo lực, phân biệt đối xử.</li>
                <li>Phát tán mã độc, virus hoặc phần mềm có hại.</li>
                <li>Thu thập thông tin cá nhân của người dùng khác trái phép.</li>
                <li>Lợi dụng nền tảng để thực hiện hành vi gian lận thương mại.</li>
              </ul>
            </section>

            {/* Điều 10 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 10. Giới hạn trách nhiệm</h2>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>
                  {siteConfig.name} cung cấp sản phẩm số &quot;nguyên trạng&quot; (as-is) tại thời điểm mua.
                  Chúng tôi đảm bảo sản phẩm hoạt động đúng mô tả trên trang sản phẩm.
                </li>
                <li>Chúng tôi không chịu trách nhiệm cho thiệt hại phát sinh từ: sử dụng sản phẩm không đúng mục đích, không tương thích với phần mềm/phần cứng của người dùng (khi đã ghi rõ yêu cầu kỹ thuật), hoặc do lỗi từ bên thứ ba.</li>
                <li>Trong mọi trường hợp, tổng mức bồi thường (nếu có) không vượt quá giá trị đơn hàng liên quan, trừ khi pháp luật quy định khác.</li>
                <li>Điều khoản này không loại trừ trách nhiệm của {siteConfig.name} đối với sản phẩm bị lỗi kỹ thuật theo quy định tại Luật Bảo vệ quyền lợi người tiêu dùng 2023.</li>
              </ol>
            </section>

            {/* Điều 11 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 11. Giải quyết tranh chấp</h2>
              <p className="mb-2">
                Căn cứ Điều 56–63, Luật Bảo vệ quyền lợi người tiêu dùng 2023, tranh chấp được giải quyết theo thứ tự ưu tiên:
              </p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong className="text-foreground">Thương lượng trực tiếp:</strong> Hai bên trao đổi qua email ({siteConfig.contact.email})
                  hoặc trang Liên hệ để tìm giải pháp. Thời hạn thương lượng: tối đa 15 ngày làm việc.
                </li>
                <li>
                  <strong className="text-foreground">Hòa giải:</strong> Nếu thương lượng không thành, các bên có thể yêu cầu
                  tổ chức hòa giải thương mại hoặc cơ quan bảo vệ quyền lợi người tiêu dùng địa phương hòa giải.
                </li>
                <li>
                  <strong className="text-foreground">Trọng tài:</strong> Tranh chấp có thể được giải quyết tại Trung tâm Trọng tài
                  Quốc tế Việt Nam (VIAC) nếu hai bên đồng ý.
                </li>
                <li>
                  <strong className="text-foreground">Tòa án:</strong> Người dùng có quyền khởi kiện tại Tòa án nhân dân có thẩm quyền
                  theo quy định Bộ luật Tố tụng dân sự 2015. Điều khoản này không hạn chế quyền khởi kiện của người tiêu dùng.
                </li>
              </ol>
            </section>

            {/* Điều 12 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 12. Bảo vệ dữ liệu cá nhân</h2>
              <p>
                Việc thu thập, xử lý và bảo vệ dữ liệu cá nhân của người dùng tuân thủ theo
                Nghị định 13/2023/NĐ-CP và được quy định chi tiết tại{' '}
                <Link href="/chinh-sach-bao-mat" className="text-primary hover:underline font-medium">
                  Chính sách bảo mật
                </Link>{' '}
                của {siteConfig.name}. Chính sách bảo mật là một phần không tách rời của Điều khoản sử dụng này.
              </p>
            </section>

            {/* Điều 13 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 13. Luật áp dụng</h2>
              <p>
                Điều khoản sử dụng này được điều chỉnh và giải thích theo pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.
                Trong trường hợp có điều khoản nào bị coi là vô hiệu hoặc không thể thi hành, các điều khoản còn lại vẫn giữ nguyên hiệu lực.
              </p>
            </section>

            {/* Điều 14 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 14. Sửa đổi, bổ sung điều khoản</h2>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Chúng tôi có quyền sửa đổi, bổ sung Điều khoản sử dụng khi cần thiết.</li>
                <li>Mọi thay đổi quan trọng sẽ được <strong className="text-foreground">thông báo trước tối thiểu 5 ngày làm việc</strong> qua email hoặc thông báo trên nền tảng.</li>
                <li>Người dùng tiếp tục sử dụng dịch vụ sau thời hạn thông báo đồng nghĩa với việc chấp nhận các thay đổi.</li>
                <li>Nếu không đồng ý với thay đổi, người dùng có quyền ngừng sử dụng dịch vụ và yêu cầu xóa tài khoản.</li>
              </ol>
            </section>

            {/* Điều 15 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 15. Thông tin liên hệ</h2>
              <p className="mb-2">Mọi thắc mắc, khiếu nại hoặc yêu cầu hỗ trợ liên quan đến Điều khoản sử dụng, vui lòng liên hệ:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Email:</strong>{' '}
                  <a href={`mailto:${siteConfig.contact.email}`} className="text-primary hover:underline">{siteConfig.contact.email}</a>
                </li>
                <li><strong className="text-foreground">Điện thoại:</strong> {siteConfig.contact.phone} (Thứ 2 – Thứ 7, 9:00 – 18:00)</li>
                <li>
                  <strong className="text-foreground">Trang liên hệ:</strong>{' '}
                  <Link href="/lien-he" className="text-primary hover:underline">Gửi tin nhắn trực tiếp</Link>
                </li>
              </ul>
              <p className="mt-3 text-xs">
                Thời gian phản hồi: trong vòng 24 giờ làm việc kể từ khi nhận được yêu cầu.
              </p>
            </section>

            <Separator className="my-6" />

            <div className="text-xs space-y-1">
              <p>
                Bằng việc sử dụng dịch vụ, bạn xác nhận đã đọc, hiểu và đồng ý với toàn bộ Điều khoản sử dụng này
                cùng{' '}
                <Link href="/chinh-sach-bao-mat" className="text-primary hover:underline">Chính sách bảo mật</Link>.
              </p>
              <p className="text-muted-foreground">
                Điều khoản có hiệu lực từ ngày 06/04/2026. Phiên bản trước đó (nếu có) không còn hiệu lực.
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
