import type { CollectionConfig } from 'payload'
import { generateSlug } from '@/lib/slug-hook'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    group: 'Nội dung',
    defaultColumns: ['name', 'type', 'category', 'pricing.price', 'featured', '_status', 'updatedAt'],
    description: 'Quản lý sản phẩm: Sample Pack, FLP, VST, Preset',
    listSearchableFields: ['name', 'slug'],
  },
  labels: { singular: 'Sản phẩm', plural: 'Sản phẩm' },
  versions: { drafts: true },
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
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Tên sản phẩm' },
    { name: 'slug', type: 'text', required: true, unique: true, admin: { position: 'sidebar' } },
    { name: 'description', type: 'richText', label: 'Mô tả' },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Loại sản phẩm',
      options: [
        { label: 'Sample Pack', value: 'sample-pack' },
        { label: 'FLP Project', value: 'flp' },
        { label: 'VST Plugin', value: 'vst' },
        { label: 'Preset', value: 'preset' },
        { label: 'Instrument', value: 'instrument' },
        { label: 'Sóng nhạc Lyrics', value: 'song-nhac-lyrics' },
      ],
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      label: 'Danh mục',
    },

    // Pricing
    {
      name: 'pricing',
      type: 'group',
      label: 'Giá',
      fields: [
        { name: 'price', type: 'number', required: true, min: 0, label: 'Giá bán (VND)' },
        { name: 'originalPrice', type: 'number', label: 'Giá gốc (VND)' },
        { name: 'isFree', type: 'checkbox', defaultValue: false, label: 'Miễn phí' },
      ],
    },

    // Downloadable File (stored in R2)
    {
      name: 'file',
      type: 'group',
      label: 'File tải về',
      fields: [
        { name: 'r2Key', type: 'text', admin: { description: 'Cloudflare R2 object key' } },
        { name: 'fileName', type: 'text', label: 'Tên file' },
        { name: 'fileSize', type: 'number', label: 'Dung lượng (bytes)' },
        { name: 'fileFormat', type: 'text', label: 'Định dạng (zip, rar...)' },
      ],
    },

    // Audio Preview
    {
      name: 'preview',
      type: 'group',
      label: 'Preview âm thanh',
      fields: [
        { name: 'audioFile', type: 'upload', relationTo: 'media', label: 'File audio preview' },
        { name: 'bpm', type: 'number', label: 'BPM' },
        { name: 'musicalKey', type: 'text', label: 'Key (Am, C#...)' },
        { name: 'duration', type: 'number', label: 'Thời lượng (giây)' },
      ],
    },

    // Images
    { name: 'thumbnail', type: 'upload', relationTo: 'media', required: true, label: 'Ảnh đại diện' },
    {
      name: 'gallery',
      type: 'array',
      label: 'Thư viện ảnh',
      fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
    },

    // Metadata
    {
      name: 'compatibility',
      type: 'array',
      label: 'Tương thích',
      fields: [
        {
          name: 'daw',
          type: 'select',
          options: [
            { label: 'FL Studio', value: 'fl-studio' },
            { label: 'Ableton Live', value: 'ableton' },
            { label: 'Logic Pro', value: 'logic-pro' },
            { label: 'All DAWs', value: 'all' },
          ],
        },
        { name: 'version', type: 'text', label: 'Phiên bản' },
      ],
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags',
      fields: [{ name: 'tag', type: 'text' }],
    },
    { name: 'downloadCount', type: 'number', defaultValue: 0, admin: { readOnly: true }, label: 'Lượt tải' },
    { name: 'featured', type: 'checkbox', defaultValue: false, label: 'Nổi bật' },
    { name: 'order', type: 'number', defaultValue: 0, label: 'Thứ tự' },
  ],
}
