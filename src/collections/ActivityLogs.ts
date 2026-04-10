import type { CollectionConfig } from 'payload'

export const ActivityLogs: CollectionConfig = {
  slug: 'activity-logs',
  admin: {
    group: 'Hệ thống',
    defaultColumns: ['type', 'action', 'detail', 'adminEmail', 'createdAt'],
    description: 'Nhật ký hoạt động admin',
  },
  labels: { singular: 'Nhật ký', plural: 'Nhật ký' },
  access: {
    read: ({ req: { user } }) => user?.role === 'admin',
    create: ({ req: { user } }) => Boolean(user),
    update: () => false,
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Loại',
      options: [
        { label: 'Đơn hàng', value: 'order' },
        { label: 'Người dùng', value: 'user' },
        { label: 'Nạp tiền', value: 'topup' },
        { label: 'Giảm giá', value: 'coupon' },
        { label: 'Sản phẩm', value: 'product' },
        { label: 'Cài đặt', value: 'settings' },
        { label: 'Hệ thống', value: 'system' },
      ],
    },
    { name: 'action', type: 'text', required: true, label: 'Hành động' },
    { name: 'detail', type: 'text', label: 'Chi tiết' },
    { name: 'adminEmail', type: 'text', label: 'Admin' },
  ],
}
