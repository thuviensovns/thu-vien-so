import type { GlobalConfig } from 'payload'
import { revalidateAfterBankConfigChange } from '@/lib/revalidate-hook'

export const BankConfig: GlobalConfig = {
  slug: 'bank-config',
  label: 'Cấu hình ngân hàng',
  admin: {
    description: 'Thông tin tài khoản ngân hàng hiển thị trên trang nạp tiền và thanh toán',
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    afterChange: [revalidateAfterBankConfigChange],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Thông tin hiển thị',
          fields: [
            {
              name: 'bankBin',
              type: 'text',
              required: true,
              defaultValue: '970423',
              label: 'Mã BIN ngân hàng',
              admin: { description: 'Mã BIN dùng để tạo QR VietQR (VD: 970423 = TPBank)' },
            },
            {
              name: 'bankName',
              type: 'text',
              required: true,
              defaultValue: 'TPBank',
              label: 'Tên ngân hàng',
            },
            {
              name: 'accountNumber',
              type: 'text',
              required: true,
              defaultValue: '10000936292',
              label: 'Số tài khoản',
            },
            {
              name: 'accountName',
              type: 'text',
              required: true,
              defaultValue: 'HOANG ANH DUNG',
              label: 'Tên chủ tài khoản',
              admin: { description: 'In hoa, không dấu' },
            },
          ],
        },
        {
          label: 'Tự động Web2M',
          description: 'Tự động kiểm tra lịch sử giao dịch & cộng tiền thông qua api.web2m.com. Lấy token trong email sau khi đăng ký gói tại api.web2m.com.',
          fields: [
            {
              name: 'web2mEnabled',
              type: 'checkbox',
              defaultValue: false,
              label: 'Bật tự động Web2M',
              admin: { description: 'Khi bật, cron poll_web2m sẽ gọi API mỗi khi được kích hoạt.' },
            },
            {
              name: 'web2mBank',
              type: 'select',
              label: 'Chọn ngân hàng',
              defaultValue: 'tpbank',
              options: [
                { label: 'TPBank', value: 'tpbank' },
                { label: 'BIDV', value: 'bidv' },
                { label: 'MBBank', value: 'mbbank' },
                { label: 'Vietcombank', value: 'vietcombank' },
                { label: 'Techcombank', value: 'techcombank' },
                { label: 'ACB', value: 'acb' },
                { label: 'Vietinbank', value: 'vietinbank' },
              ],
            },
            {
              name: 'web2mApiVersion',
              type: 'select',
              label: 'Phiên bản API',
              defaultValue: 'v3',
              options: [
                { label: 'V1', value: 'v1' },
                { label: 'V2', value: 'v2' },
                { label: 'V3 (mới nhất)', value: 'v3' },
              ],
            },
            {
              name: 'web2mAccountNumber',
              type: 'text',
              label: 'Số tài khoản đăng nhập IB',
              admin: { description: 'Số tài khoản Internet Banking dùng để đăng nhập Web2M.' },
            },
            {
              name: 'web2mPassword',
              type: 'text',
              label: 'Mật khẩu Internet Banking',
              admin: { description: 'Lưu trữ tĩnh trong Payload — đảm bảo quyền truy cập admin.' },
            },
            {
              name: 'web2mToken',
              type: 'text',
              label: 'Token Web2M',
              admin: { description: 'Token Web2M gửi qua email sau khi mua gói (ứng với ngân hàng).' },
            },
            {
              name: 'web2mApiUrl',
              type: 'text',
              label: 'URL API tuỳ chỉnh (optional)',
              admin: {
                description: 'Mặc định: https://api.web2m.com/historyapi{version}/{bank}/{account}/{password}/{token}. Chỉ điền khi Web2M cung cấp URL khác. Các placeholder hỗ trợ: {account}, {password}, {token}.',
              },
            },
            {
              name: 'web2mLastPollAt',
              type: 'date',
              label: 'Lần poll gần nhất',
              admin: { readOnly: true, position: 'sidebar' },
            },
            {
              name: 'web2mLastStatus',
              type: 'text',
              label: 'Kết quả poll gần nhất',
              admin: { readOnly: true, position: 'sidebar' },
            },
          ],
        },
      ],
    },
  ],
}
