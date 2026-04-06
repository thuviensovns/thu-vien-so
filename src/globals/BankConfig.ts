import type { GlobalConfig } from 'payload'

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
}
