import type { CollectionConfig } from 'payload'

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    group: 'Thương mại',
    defaultColumns: ['orderNumber', 'user', 'total', 'status', 'payment.method', 'createdAt'],
    description: 'Quản lý đơn hàng và thanh toán',
    listSearchableFields: ['orderNumber', 'customerEmail', 'customerPhone'],
  },
  labels: { singular: 'Đơn hàng', plural: 'Đơn hàng' },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) return { user: { equals: user.id } }
      return false
    },
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'orderNumber', type: 'text', required: true, unique: true, label: 'Mã đơn hàng' },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, label: 'Khách hàng' },
    {
      name: 'items',
      type: 'array',
      required: true,
      label: 'Sản phẩm',
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        { name: 'price', type: 'number', required: true, label: 'Giá tại thời điểm mua' },
        { name: 'productName', type: 'text', label: 'Tên sản phẩm' },
      ],
    },
    { name: 'total', type: 'number', required: true, label: 'Tổng tiền (VND)' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      label: 'Trạng thái',
      options: [
        { label: 'Chờ xử lý', value: 'pending' },
        { label: 'Đang xử lý', value: 'processing' },
        { label: 'Đã thanh toán', value: 'paid' },
        { label: 'Thất bại', value: 'failed' },
        { label: 'Hoàn tiền', value: 'refunded' },
      ],
    },
    {
      name: 'payment',
      type: 'group',
      label: 'Thanh toán',
      fields: [
        {
          name: 'method',
          type: 'select',
          label: 'Phương thức',
          options: [
            { label: 'VNPay', value: 'vnpay' },
            { label: 'MoMo', value: 'momo' },
            { label: 'ZaloPay', value: 'zalopay' },
            { label: 'Chuyển khoản', value: 'bank-transfer' },
            { label: 'Số dư', value: 'balance' },
          ],
        },
        { name: 'transactionId', type: 'text', label: 'Mã giao dịch' },
        { name: 'paidAt', type: 'date', label: 'Ngày thanh toán' },
        { name: 'rawResponse', type: 'json', admin: { readOnly: true }, label: 'Dữ liệu gốc' },
      ],
    },
    { name: 'transferCode', type: 'text', index: true, label: 'Nội dung CK', admin: { description: 'NAPKH{userId} — mã chuyển khoản cố định theo khách hàng' } },
    { name: 'customerEmail', type: 'email', label: 'Email khách hàng' },
    { name: 'customerPhone', type: 'text', label: 'SĐT khách hàng' },
    { name: 'note', type: 'textarea', label: 'Ghi chú' },

    // Token-based download system
    { name: 'downloadToken', type: 'text', unique: true, index: true, label: 'Download Token', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'downloadExpiresAt', type: 'date', label: 'Download hết hạn', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
