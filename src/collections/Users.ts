import type { CollectionConfig } from 'payload'
import { ensureAffiliateAccount } from '@/lib/affiliate'

const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'

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
        // Only the designated admin can have admin role
        update: ({ req: { user } }) => user?.role === 'admin' && user?.email === ADMIN_EMAIL,
      },
      hooks: {
        beforeChange: [
          ({ value, data, originalDoc }) => {
            // Prevent setting role to admin for anyone except the designated admin email
            if (value === 'admin') {
              const email = data?.email || originalDoc?.email
              if (email !== ADMIN_EMAIL) return 'customer'
            }
            return value
          },
        ],
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
      // Field-level access: only admin can edit from admin UI.
      // Server-side payload.update({ overrideAccess: true }) bypasses this entirely
      // (used by webhook bank-transfer + admin manual topup endpoint).
      // NOTE: Do not use field beforeChange hook for this — Payload 3.80 does not
      // forward `overrideAccess` into field hook args, so server-side updates would
      // be silently reverted (regression from commit 50fb146).
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation }) => {
        // On new user creation, provision an affiliate_accounts row with an
        // email-derived ref code so every customer has a shareable code ready.
        // Fire-and-forget — a failure here must not block registration.
        if (operation !== 'create' || !doc?.id) return
        ensureAffiliateAccount(Number(doc.id), doc.email).catch(() => {})
      },
    ],
  },
}
