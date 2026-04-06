import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    group: 'Hệ thống',
    defaultColumns: ['email', 'displayName', 'role', 'createdAt'],
    description: 'Quản lý tài khoản người dùng và phân quyền',
    listSearchableFields: ['email', 'displayName', 'phone'],
  },
  labels: { singular: 'Người dùng', plural: 'Người dùng' },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      // Non-admin can only read their own document
      return { id: { equals: user.id } }
    },
    create: () => true,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { id: { equals: user.id } }
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'displayName', type: 'text', label: 'Tên hiển thị' },
    { name: 'phone', type: 'text', label: 'Số điện thoại' },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'customer',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Customer', value: 'customer' },
      ],
      required: true,
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    {
      name: 'balance',
      type: 'number',
      defaultValue: 0,
      min: 0,
      label: 'Số dư (VND)',
      admin: { description: 'Số dư tài khoản người dùng' },
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
      },
    },
  ],
}
