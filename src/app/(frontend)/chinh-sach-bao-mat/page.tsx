import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Scale } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { siteConfig } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Chính sách bảo mật — Thư Viện Số',
  description: 'Chính sách bảo vệ dữ liệu cá nhân của Thư Viện Số, tuân thủ Nghị định 13/2023/NĐ-CP.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="container relative mx-auto px-4 py-10 sm:py-14 text-center">
          <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary border-primary/20 text-xs">
            <Shield className="h-3 w-3 mr-1" />
            Bảo mật
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Chính sách bảo mật</h1>
          <p className="mt-2 text-sm text-muted-foreground">Cập nhật lần cuối: 06/04/2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <article className="max-w-3xl mx-auto">
          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

            {/* Căn cứ pháp lý */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-foreground mb-1.5">
                <Scale className="h-3.5 w-3.5" />
                Căn cứ pháp lý
              </p>
              <p>
                Chính sách bảo mật này được xây dựng căn cứ theo Nghị định 13/2023/NĐ-CP ngày 17/04/2023
                về Bảo vệ dữ liệu cá nhân; Luật An ninh mạng 2018 (số 24/2018/QH14);
                Luật Giao dịch điện tử 2023 (số 20/2023/QH15); và Luật Bảo vệ quyền lợi người tiêu dùng 2023
                (số 19/2023/QH15).
              </p>
            </div>

            {/* Điều 1 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 1. Đơn vị kiểm soát dữ liệu</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Tên nền tảng:</strong> {siteConfig.name}</li>
                <li><strong className="text-foreground">Email liên hệ bảo mật:</strong>{' '}
                  <a href={`mailto:${siteConfig.contact.email}`} className="text-primary hover:underline">{siteConfig.contact.email}</a>
                </li>
                <li><strong className="text-foreground">Số điện thoại:</strong> {siteConfig.contact.phone}</li>
              </ul>
              <p className="mt-2">
                {siteConfig.name} là đơn vị kiểm soát dữ liệu cá nhân theo Điều 2 Nghị định 13/2023/NĐ-CP,
                chịu trách nhiệm về việc thu thập, xử lý và bảo vệ dữ liệu cá nhân của người dùng.
              </p>
            </section>

            {/* Điều 2 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 2. Dữ liệu cá nhân được thu thập</h2>
              <p className="mb-2">Theo Điều 9 Nghị định 13/2023/NĐ-CP, chúng tôi thu thập các loại dữ liệu sau:</p>

              <div className="space-y-3 mt-3">
                <div>
                  <p className="font-medium text-foreground mb-1">2.1. Dữ liệu cá nhân cơ bản:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Họ tên, địa chỉ email khi đăng ký tài khoản.</li>
                    <li>Số điện thoại (nếu cung cấp khi liên hệ hỗ trợ).</li>
                    <li>Tên hiển thị (display name) do người dùng tự thiết lập.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">2.2. Dữ liệu giao dịch:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Lịch sử mua hàng, lịch sử nạp tiền.</li>
                    <li>Phương thức thanh toán đã sử dụng (không bao gồm số thẻ ngân hàng).</li>
                    <li>Số dư tài khoản trên nền tảng.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">2.3. Dữ liệu kỹ thuật:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Địa chỉ IP khi truy cập và tải sản phẩm.</li>
                    <li>Loại trình duyệt, hệ điều hành, thiết bị.</li>
                    <li>Thời gian truy cập, trang đã xem.</li>
                    <li>Cookie phiên đăng nhập.</li>
                  </ul>
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
                <p className="font-medium text-foreground mb-1">Dữ liệu KHÔNG thu thập:</p>
                <p>
                  Chúng tôi không thu thập dữ liệu cá nhân nhạy cảm (quan điểm chính trị, tôn giáo, tình trạng sức khỏe,
                  sinh trắc học, đời sống tình dục) theo định nghĩa tại Điều 2, khoản 4 Nghị định 13/2023/NĐ-CP.
                </p>
              </div>
            </section>

            {/* Điều 3 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 3. Mục đích xử lý dữ liệu</h2>
              <p className="mb-2">Theo Điều 3 Nghị định 13/2023/NĐ-CP, dữ liệu được xử lý cho các mục đích cụ thể:</p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li><strong className="text-foreground">Thực hiện hợp đồng:</strong> Xử lý đơn hàng, cung cấp sản phẩm đã mua, quản lý tài khoản.</li>
                <li><strong className="text-foreground">Hỗ trợ khách hàng:</strong> Phản hồi câu hỏi, xử lý khiếu nại, hỗ trợ kỹ thuật.</li>
                <li><strong className="text-foreground">Bảo mật hệ thống:</strong> Phát hiện và ngăn chặn gian lận, truy cập trái phép, bảo vệ nền tảng.</li>
                <li><strong className="text-foreground">Cải thiện dịch vụ:</strong> Phân tích hành vi sử dụng (ẩn danh) để nâng cao trải nghiệm.</li>
                <li><strong className="text-foreground">Thông báo:</strong> Gửi thông tin về đơn hàng, cập nhật tài khoản, thay đổi điều khoản (không gửi quảng cáo trừ khi người dùng đồng ý).</li>
                <li><strong className="text-foreground">Tuân thủ pháp luật:</strong> Đáp ứng yêu cầu từ cơ quan nhà nước có thẩm quyền theo quy định.</li>
              </ol>
            </section>

            {/* Điều 4 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 4. Cơ sở pháp lý xử lý dữ liệu</h2>
              <p className="mb-2">Theo Điều 11 Nghị định 13/2023/NĐ-CP, chúng tôi xử lý dữ liệu dựa trên:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Sự đồng ý:</strong> Người dùng đồng ý khi đăng ký tài khoản và chấp nhận Chính sách bảo mật.</li>
                <li><strong className="text-foreground">Thực hiện hợp đồng:</strong> Cần thiết để cung cấp dịch vụ đã cam kết.</li>
                <li><strong className="text-foreground">Nghĩa vụ pháp lý:</strong> Khi pháp luật yêu cầu lưu trữ hoặc cung cấp thông tin.</li>
                <li><strong className="text-foreground">Lợi ích hợp pháp:</strong> Bảo vệ an ninh hệ thống, phòng chống gian lận.</li>
              </ul>
            </section>

            {/* Điều 5 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 5. Thời hạn lưu trữ dữ liệu</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse mt-2">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-foreground">Loại dữ liệu</th>
                      <th className="text-left py-2 font-medium text-foreground">Thời hạn lưu trữ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-2 pr-4">Thông tin tài khoản</td>
                      <td className="py-2">Đến khi người dùng yêu cầu xóa tài khoản + 30 ngày</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Dữ liệu giao dịch</td>
                      <td className="py-2">Tối thiểu 10 năm (theo Luật Kế toán 2015)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Dữ liệu hỗ trợ/liên hệ</td>
                      <td className="py-2">3 năm kể từ lần liên hệ cuối</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Dữ liệu kỹ thuật (IP, log)</td>
                      <td className="py-2">12 tháng</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Cookie phiên đăng nhập</td>
                      <td className="py-2">Đến khi đăng xuất hoặc hết hạn phiên (tối đa 30 ngày)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs">
                Sau khi hết thời hạn lưu trữ, dữ liệu sẽ được xóa vĩnh viễn hoặc ẩn danh hóa không thể khôi phục
                theo Điều 16 Nghị định 13/2023/NĐ-CP.
              </p>
            </section>

            {/* Điều 6 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 6. Chia sẻ dữ liệu với bên thứ ba</h2>
              <p className="mb-2">
                Chúng tôi <strong className="text-foreground">không bán, cho thuê hoặc trao đổi</strong> dữ liệu cá nhân
                vì mục đích thương mại. Dữ liệu chỉ được chia sẻ trong các trường hợp:
              </p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong className="text-foreground">Đối tác xử lý thanh toán:</strong> VNPay, MoMo — chỉ thông tin cần thiết
                  để hoàn tất giao dịch (mã đơn hàng, số tiền). Các đối tác này có chính sách bảo mật riêng
                  và chịu trách nhiệm bảo vệ dữ liệu theo hợp đồng.
                </li>
                <li>
                  <strong className="text-foreground">Dịch vụ hạ tầng:</strong> Nhà cung cấp hosting, CDN — để vận hành nền tảng.
                  Dữ liệu được mã hóa trong quá trình truyền tải.
                </li>
                <li>
                  <strong className="text-foreground">Cơ quan nhà nước có thẩm quyền:</strong> Khi có yêu cầu hợp pháp bằng văn bản
                  theo quy định Luật An ninh mạng 2018 và pháp luật liên quan.
                </li>
              </ol>
            </section>

            {/* Điều 7 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 7. Quyền của chủ thể dữ liệu</h2>
              <p className="mb-2">
                Theo Điều 9 Nghị định 13/2023/NĐ-CP, người dùng có các quyền sau đối với dữ liệu cá nhân:
              </p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong className="text-foreground">Quyền được biết:</strong> Được thông báo về hoạt động xử lý dữ liệu,
                  bao gồm loại dữ liệu, mục đích, phương thức, bên nhận dữ liệu.
                </li>
                <li>
                  <strong className="text-foreground">Quyền đồng ý:</strong> Được lựa chọn đồng ý hoặc không đồng ý
                  với việc xử lý dữ liệu, trừ trường hợp pháp luật quy định khác.
                </li>
                <li>
                  <strong className="text-foreground">Quyền truy cập:</strong> Được yêu cầu xem toàn bộ dữ liệu cá nhân
                  mà chúng tôi đang lưu trữ.
                </li>
                <li>
                  <strong className="text-foreground">Quyền chỉnh sửa:</strong> Được yêu cầu sửa đổi dữ liệu không chính xác
                  hoặc không đầy đủ.
                </li>
                <li>
                  <strong className="text-foreground">Quyền xóa:</strong> Được yêu cầu xóa dữ liệu cá nhân, trừ trường hợp
                  pháp luật yêu cầu lưu trữ (ví dụ: dữ liệu giao dịch theo Luật Kế toán).
                </li>
                <li>
                  <strong className="text-foreground">Quyền hạn chế xử lý:</strong> Được yêu cầu giới hạn phạm vi xử lý dữ liệu.
                </li>
                <li>
                  <strong className="text-foreground">Quyền rút lại đồng ý:</strong> Được rút lại sự đồng ý bất cứ lúc nào.
                  Việc rút lại không ảnh hưởng đến tính hợp pháp của việc xử lý trước đó.
                </li>
                <li>
                  <strong className="text-foreground">Quyền khiếu nại:</strong> Được khiếu nại đến cơ quan chuyên trách
                  bảo vệ dữ liệu cá nhân thuộc Bộ Công an nếu cho rằng quyền bị xâm phạm.
                </li>
              </ol>
              <p className="mt-3">
                Để thực hiện các quyền trên, vui lòng gửi yêu cầu qua email{' '}
                <a href={`mailto:${siteConfig.contact.email}`} className="text-primary hover:underline">{siteConfig.contact.email}</a>{' '}
                với tiêu đề &quot;Yêu cầu về dữ liệu cá nhân&quot;. Chúng tôi sẽ phản hồi trong vòng{' '}
                <strong className="text-foreground">72 giờ</strong> và xử lý hoàn tất trong{' '}
                <strong className="text-foreground">15 ngày làm việc</strong>.
              </p>
            </section>

            {/* Điều 8 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 8. Biện pháp bảo mật</h2>
              <p className="mb-2">Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ dữ liệu:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Mã hóa:</strong> SSL/TLS cho toàn bộ kết nối. Mật khẩu được hash bằng thuật toán không thể giải mã ngược.</li>
                <li><strong className="text-foreground">Kiểm soát truy cập:</strong> Phân quyền nghiêm ngặt, chỉ nhân sự được ủy quyền mới truy cập dữ liệu.</li>
                <li><strong className="text-foreground">Không lưu trữ thông tin thẻ:</strong> Thanh toán được xử lý qua cổng thanh toán có giấy phép. Chúng tôi không lưu số thẻ, CVV hoặc thông tin ngân hàng.</li>
                <li><strong className="text-foreground">Sao lưu:</strong> Dữ liệu được sao lưu định kỳ để đảm bảo khả năng khôi phục.</li>
                <li><strong className="text-foreground">Giám sát:</strong> Hệ thống giám sát truy cập bất thường 24/7.</li>
              </ul>
            </section>

            {/* Điều 9 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 9. Thông báo vi phạm dữ liệu</h2>
              <p>
                Theo Điều 23 Nghị định 13/2023/NĐ-CP, trong trường hợp xảy ra sự cố vi phạm dữ liệu cá nhân:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5 mt-2">
                <li>
                  Chúng tôi sẽ thông báo cho <strong className="text-foreground">Cơ quan chuyên trách bảo vệ dữ liệu cá nhân
                  (Bộ Công an)</strong> trong vòng <strong className="text-foreground">72 giờ</strong> kể từ khi phát hiện sự cố.
                </li>
                <li>Thông báo cho người dùng bị ảnh hưởng qua email, nêu rõ: loại dữ liệu bị ảnh hưởng, nguyên nhân, biện pháp khắc phục.</li>
                <li>Thực hiện ngay các biện pháp khắc phục để hạn chế thiệt hại.</li>
              </ol>
            </section>

            {/* Điều 10 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 10. Cookie và công nghệ tương tự</h2>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-foreground mb-1">10.1. Cookie thiết yếu (bắt buộc):</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Duy trì phiên đăng nhập.</li>
                    <li>Lưu giỏ hàng, tùy chọn giao diện (dark/light mode).</li>
                    <li>Bảo mật chống CSRF.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">10.2. Cookie phân tích (tùy chọn):</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Thống kê lượt truy cập, trang phổ biến (dữ liệu ẩn danh).</li>
                  </ul>
                </div>
                <p>
                  Bạn có thể tắt cookie trong cài đặt trình duyệt. Lưu ý: tắt cookie thiết yếu có thể
                  ảnh hưởng đến khả năng đăng nhập và sử dụng một số tính năng.
                </p>
              </div>
            </section>

            {/* Điều 11 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 11. Chuyển giao dữ liệu xuyên biên giới</h2>
              <p>
                Theo Điều 25 Nghị định 13/2023/NĐ-CP, trong trường hợp dữ liệu cần được xử lý bởi dịch vụ đặt tại nước ngoài
                (hosting, CDN), chúng tôi đảm bảo:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 mt-2">
                <li>Chỉ chuyển dữ liệu kỹ thuật cần thiết cho vận hành nền tảng.</li>
                <li>Đối tác phải đáp ứng tiêu chuẩn bảo mật tương đương hoặc cao hơn quy định Việt Nam.</li>
                <li>Lập hồ sơ đánh giá tác động chuyển giao dữ liệu theo quy định.</li>
              </ul>
            </section>

            {/* Điều 12 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 12. Bảo vệ dữ liệu trẻ em</h2>
              <p>
                Theo Điều 20 Nghị định 13/2023/NĐ-CP, đối với người dùng dưới 16 tuổi:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 mt-2">
                <li>Việc thu thập và xử lý dữ liệu cần có sự đồng ý của cha, mẹ hoặc người giám hộ.</li>
                <li>Chúng tôi không chủ đích thu thập dữ liệu của trẻ em dưới 16 tuổi mà không có sự đồng ý hợp lệ.</li>
                <li>Nếu phát hiện đã thu thập dữ liệu trẻ em mà không có sự đồng ý hợp lệ, chúng tôi sẽ xóa ngay.</li>
              </ul>
            </section>

            {/* Điều 13 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 13. Sửa đổi chính sách bảo mật</h2>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Chính sách này có thể được cập nhật để phản ánh thay đổi trong hoạt động hoặc quy định pháp luật.</li>
                <li>Thay đổi quan trọng sẽ được thông báo qua email trước khi có hiệu lực tối thiểu <strong className="text-foreground">5 ngày làm việc</strong>.</li>
                <li>Phiên bản hiện tại luôn được công bố tại trang này với ngày cập nhật rõ ràng.</li>
              </ol>
            </section>

            {/* Điều 14 */}
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Điều 14. Liên hệ về bảo mật</h2>
              <p className="mb-2">Mọi yêu cầu liên quan đến dữ liệu cá nhân, vui lòng liên hệ:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Email:</strong>{' '}
                  <a href={`mailto:${siteConfig.contact.email}`} className="text-primary hover:underline">{siteConfig.contact.email}</a>
                  {' '}(ghi tiêu đề: &quot;Yêu cầu về dữ liệu cá nhân&quot;)
                </li>
                <li><strong className="text-foreground">Điện thoại:</strong> {siteConfig.contact.phone} (Thứ 2 – Thứ 7, 9:00 – 18:00)</li>
                <li>
                  <strong className="text-foreground">Trang liên hệ:</strong>{' '}
                  <Link href="/lien-he" className="text-primary hover:underline">Gửi yêu cầu trực tiếp</Link>
                </li>
              </ul>
              <p className="mt-2 text-xs">
                Nếu không hài lòng với cách chúng tôi xử lý dữ liệu, bạn có quyền khiếu nại đến
                Cơ quan chuyên trách bảo vệ dữ liệu cá nhân thuộc Bộ Công an theo Điều 30 Nghị định 13/2023/NĐ-CP.
              </p>
            </section>

            <Separator className="my-6" />

            <div className="text-xs space-y-1">
              <p>
                Chính sách bảo mật này là một phần không tách rời của{' '}
                <Link href="/dieu-khoan" className="text-primary hover:underline">Điều khoản sử dụng</Link>.
                Bằng việc sử dụng dịch vụ, bạn xác nhận đã đọc và đồng ý với chính sách này.
              </p>
              <p className="text-muted-foreground">
                Có hiệu lực từ ngày 06/04/2026. Phiên bản trước đó (nếu có) không còn hiệu lực.
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
