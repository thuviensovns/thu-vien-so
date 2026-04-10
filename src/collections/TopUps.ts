import type { CollectionConfig } from 'payload'

export const TopUps: CollectionConfig = {
  slug: 'topups',
  admin: {
    useAsTitle: 'transferCode',
    group: 'Thương mại',
    defaultColumns: ['transferCode', 'user', 'amount', 'status', 'createdAt'],
    description: 'Lịch sử nạp tiền qua chuyển khoản ngân hàng',
    listSearchableFields: ['transferCode', 'bankTransactionId'],
  },
  labels: { singular: 'Nạp tiền', plural: 'Nạp tiền' },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) return { user: { equals: user.id } }
      return false
    },
    create: () => true,
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Người dùng',
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 1000,
      label: 'Số tiền (VND)',
    },
    {
      name: 'transferCode',
      type: 'text',
      required: true,
      unique: true,
      label: 'Nội dung chuyển khoản',
      admin: { description: 'Mã nhận dạng giao dịch (VD: NAP1A2B3C)' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      label: 'Trạng thái',
      options: [
        { label: 'Chờ xác nhận', value: 'pending' },
        { label: 'Thành công', value: 'completed' },
        { label: 'Thất bại', value: 'failed' },
        { label: 'Hết hạn', value: 'expired' },
      ],
    },
    {
      name: 'bankTransactionId',
      type: 'text',
      label: 'Mã giao dịch ngân hàng',
      admin: { description: 'Mã giao dịch từ webhook ngân hàng (Sepay/Casso)' },
    },
    {
      name: 'bankDescription',
      type: 'text',
      label: 'Nội dung chuyển khoản gốc',
    },
    {
      name: 'confirmedAt',
      type: 'date',
      label: 'Ngày xác nhận',
    },
    {
      name: 'readByAdmin',
      type: 'checkbox',
      defaultValue: false,
      label: 'Admin đã xem',
      admin: { position: 'sidebar' },
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: 'Hết hạn lúc',
      admin: { description: 'Giao dịch chờ hết hạn sau 30 phút' },
    },
  ],
}
