import type { CollectionConfig } from 'payload'
import { generateSlug } from '@/lib/slug-hook'
import { revalidateAfterCategoryChange } from '@/lib/revalidate-hook'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    group: 'Nội dung',
    defaultColumns: ['name', 'type', 'parent', 'order'],
    description: 'Phân loại sản phẩm theo danh mục',
  },
  labels: { singular: 'Danh mục', plural: 'Danh mục' },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.name && !data?.slug) {
          data.slug = generateSlug(data.name)
        }
        return data
      },
    ],
    afterChange: [revalidateAfterCategoryChange],
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Tên danh mục' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    { name: 'description', type: 'textarea', label: 'Mô tả' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Hình ảnh' },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Loại',
      options: [
        { label: 'Sample Pack', value: 'sample-pack' },
        { label: 'FLP Project', value: 'flp' },
        { label: 'VST Plugin', value: 'vst' },
        { label: 'Preset', value: 'preset' },
        { label: 'Instrument', value: 'instrument' },
        { label: 'Sóng nhạc Lyrics', value: 'song-nhac-lyrics' },
      ],
    },
    { name: 'parent', type: 'relationship', relationTo: 'categories', label: 'Danh mục cha' },
    { name: 'order', type: 'number', defaultValue: 0, label: 'Thứ tự' },
  ],
}
