import type { CollectionConfig } from 'payload'
import { generateSlug } from '@/lib/slug-hook'

export const BlogPosts: CollectionConfig = {
  slug: 'blog-posts',
  admin: {
    useAsTitle: 'title',
    group: 'Nội dung',
    defaultColumns: ['title', 'blogCategory', 'author', '_status', 'publishedAt'],
    description: 'Quản lý bài viết blog và hướng dẫn',
    listSearchableFields: ['title', 'slug'],
  },
  labels: { singular: 'Bài viết', plural: 'Bài viết' },
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
        if (data?.title && !data?.slug) {
          data.slug = generateSlug(data.title)
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Tiêu đề' },
    { name: 'slug', type: 'text', required: true, unique: true, admin: { position: 'sidebar' } },
    { name: 'excerpt', type: 'textarea', maxLength: 300, label: 'Tóm tắt' },
    { name: 'content', type: 'richText', label: 'Nội dung' },
    { name: 'featuredImage', type: 'upload', relationTo: 'media', label: 'Ảnh đại diện' },
    { name: 'author', type: 'relationship', relationTo: 'users', label: 'Tác giả' },
    {
      name: 'blogCategory',
      type: 'select',
      label: 'Chuyên mục',
      options: [
        { label: 'Hướng dẫn', value: 'tutorial' },
        { label: 'Mẹo hay', value: 'tips' },
        { label: 'Tin tức', value: 'news' },
        { label: 'Đánh giá', value: 'review' },
      ],
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags',
      fields: [{ name: 'tag', type: 'text' }],
    },
    { name: 'publishedAt', type: 'date', label: 'Ngày xuất bản' },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        { name: 'metaTitle', type: 'text', label: 'Meta Title' },
        { name: 'metaDescription', type: 'textarea', maxLength: 160, label: 'Meta Description' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
      ],
    },
  ],
}
