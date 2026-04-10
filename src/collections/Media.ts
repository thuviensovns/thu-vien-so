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
      { name: 'thumbnail', width: 480, height: 270 },
      { name: 'card', width: 800, height: 450 },
      { name: 'hero', width: 1920, height: 1080 },
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
