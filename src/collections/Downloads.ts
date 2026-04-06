import type { CollectionConfig } from 'payload'

export const Downloads: CollectionConfig = {
  slug: 'downloads',
  admin: {
    group: 'Thương mại',
    defaultColumns: ['product', 'user', 'downloadCount', 'maxDownloads', 'expiresAt', 'createdAt'],
    description: 'Theo dõi lượt tải và quyền truy cập file',
  },
  labels: { singular: 'Lượt tải', plural: 'Lượt tải' },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) return { user: { equals: user.id } }
      return false
    },
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, label: 'Người dùng' },
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, label: 'Đơn hàng' },
    { name: 'product', type: 'relationship', relationTo: 'products', required: true, label: 'Sản phẩm' },
    { name: 'downloadCount', type: 'number', defaultValue: 0, label: 'Số lần tải' },
    { name: 'maxDownloads', type: 'number', defaultValue: 5, label: 'Tối đa' },
    { name: 'lastDownloadedAt', type: 'date', label: 'Lần tải cuối' },
    { name: 'expiresAt', type: 'date', label: 'Hết hạn' },
    {
      name: 'downloadLog',
      type: 'array',
      label: 'Nhật ký tải',
      fields: [
        { name: 'downloadedAt', type: 'date', label: 'Thời gian' },
        { name: 'ipAddress', type: 'text', label: 'IP' },
        { name: 'userAgent', type: 'text', label: 'Trình duyệt' },
      ],
    },
  ],
}
