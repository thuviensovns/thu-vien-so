import type { CollectionConfig } from 'payload'

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  admin: {
    useAsTitle: 'code',
    group: 'Thương mại',
    defaultColumns: ['code', 'type', 'value', 'active', 'usedCount', 'createdAt'],
    description: 'Quản lý mã giảm giá',
  },
  labels: { singular: 'Mã giảm giá', plural: 'Mã giảm giá' },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, label: 'Mã giảm giá' },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'percent',
      label: 'Loại',
      options: [
        { label: 'Phần trăm', value: 'percent' },
        { label: 'Cố định (VND)', value: 'fixed' },
      ],
    },
    { name: 'value', type: 'number', required: true, label: 'Giá trị', min: 1 },
    { name: 'minOrder', type: 'number', defaultValue: 0, label: 'Đơn tối thiểu (VND)' },
    { name: 'maxUses', type: 'number', defaultValue: 0, label: 'Số lần sử dụng tối đa (0 = không giới hạn)' },
    { name: 'usedCount', type: 'number', defaultValue: 0, label: 'Đã sử dụng', admin: { readOnly: true } },
    { name: 'active', type: 'checkbox', defaultValue: true, label: 'Đang hoạt động' },
    { name: 'expiresAt', type: 'date', label: 'Ngày hết hạn' },
  ],
}
