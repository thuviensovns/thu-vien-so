import type { CollectionConfig } from 'payload'

export const ContactMessages: CollectionConfig = {
  slug: 'contact-messages',
  admin: {
    useAsTitle: 'subject',
    group: 'Hỗ trợ',
    defaultColumns: ['name', 'email', 'subject', 'status', 'createdAt'],
    description: 'Tin nhắn liên hệ từ khách hàng',
    listSearchableFields: ['name', 'email', 'subject', 'message'],
  },
  labels: { singular: 'Tin nhắn', plural: 'Tin nhắn hỗ trợ' },
  access: {
    read: ({ req: { user } }) => user?.role === 'admin',
    create: () => false, // Only via /api/contact server route (uses overrideAccess)
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Họ tên' },
    { name: 'email', type: 'email', required: true, label: 'Email' },
    { name: 'subject', type: 'text', label: 'Tiêu đề', defaultValue: 'Không có tiêu đề' },
    { name: 'message', type: 'textarea', required: true, label: 'Nội dung' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      label: 'Trạng thái',
      options: [
        { label: 'Mới', value: 'new' },
        { label: 'Đang xử lý', value: 'processing' },
        { label: 'Đã phản hồi', value: 'replied' },
        { label: 'Đã đóng', value: 'closed' },
      ],
    },
    { name: 'adminNote', type: 'textarea', label: 'Ghi chú admin', admin: { position: 'sidebar' } },
    { name: 'ipAddress', type: 'text', label: 'IP Address', access: { update: () => false }, admin: { readOnly: true, position: 'sidebar' } },
  ],
}
