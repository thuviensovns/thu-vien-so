import type { GlobalConfig } from 'payload'
import { revalidateAfterSiteContentChange } from '@/lib/revalidate-hook'

export const SiteContent: GlobalConfig = {
  slug: 'site-content',
  label: 'Nội dung trang web',
  admin: {
    description: 'Cấu hình nội dung hiển thị trên trang web (hero, footer, SEO, mô tả danh mục...)',
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    afterChange: [revalidateAfterSiteContentChange],
  },
  fields: [
    {
      name: 'settings',
      type: 'json',
      label: 'Cài đặt trang web',
      admin: { description: 'JSON chứa toàn bộ site settings (hero, footer, SEO, contact, social...)' },
    },
    {
      name: 'categoryDescriptions',
      type: 'json',
      label: 'Mô tả danh mục',
      admin: { description: 'JSON chứa mô tả cho từng danh mục sản phẩm' },
    },
  ],
}
