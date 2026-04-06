import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Nội dung',
    description: 'Quản lý hình ảnh và file audio',
  },
  labels: { singular: 'Media', plural: 'Thư viện Media' },
  upload: {
    mimeTypes: ['image/*', 'audio/*'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300 },
      { name: 'card', width: 600, height: 450 },
      { name: 'hero', width: 1200, height: 600 },
    ],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'alt', type: 'text', label: 'Mô tả hình ảnh' },
  ],
}
