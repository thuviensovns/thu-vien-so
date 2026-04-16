/**
 * Catalog of admin permissions. Grouped by category for UI display.
 * Used by Roles & Permissions system — sub-admins are assigned a role
 * containing a subset of these keys.
 *
 * The owner (ADMIN_EMAIL in Users.ts) always has ALL permissions regardless
 * of role assignment — super-admin bypass.
 */

export const ADMIN_EMAIL = 'hoangdunggame2k@gmail.com'

export type PermissionKey =
  // Dashboard
  | 'dashboard.view'
  // Users
  | 'users.view'
  | 'users.edit'
  | 'users.delete'
  | 'users.balance_adjust'
  | 'users.reset_password'
  | 'users.assign_role'
  // Orders
  | 'orders.view'
  | 'orders.edit'
  | 'orders.cancel'
  | 'orders.refund'
  // Products
  | 'products.view'
  | 'products.edit'
  | 'products.delete'
  // Top-ups
  | 'topups.view'
  | 'topups.approve'
  | 'topups.deduct'
  // Coupons
  | 'coupons.view'
  | 'coupons.edit'
  // Bank / QR config
  | 'bank.view'
  | 'bank.edit'
  // Content (spin, site content)
  | 'content.view'
  | 'content.edit'
  // Messages / chat
  | 'messages.view'
  | 'messages.reply'
  // Logs
  | 'logs.view'
  | 'logs.delete'
  // Settings
  | 'settings.view'
  | 'settings.edit'
  // Roles & permissions
  | 'roles.view'
  | 'roles.edit'
  // Affiliate
  | 'affiliate.view'
  | 'affiliate.config'
  | 'affiliate.withdraw_approve'
  // Email campaigns
  | 'email.view'
  | 'email.send'
  | 'email.config'
  // Automations
  | 'automations.view'
  | 'automations.edit'
  // Security — IP block + failed-login
  | 'security.view'
  | 'security.ip_block_edit'
  // Cron
  | 'cron.view'
  | 'cron.edit'

export interface PermissionCategory {
  key: string
  label: string
  permissions: {
    key: PermissionKey
    label: string
    description?: string
  }[]
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: 'dashboard',
    label: 'Tổng quan',
    permissions: [{ key: 'dashboard.view', label: 'Xem dashboard' }],
  },
  {
    key: 'users',
    label: 'Người dùng',
    permissions: [
      { key: 'users.view', label: 'Xem danh sách' },
      { key: 'users.edit', label: 'Sửa thông tin' },
      { key: 'users.delete', label: 'Xóa người dùng' },
      { key: 'users.balance_adjust', label: 'Cộng/Trừ số dư' },
      { key: 'users.reset_password', label: 'Đặt lại mật khẩu' },
      { key: 'users.assign_role', label: 'Gán vai trò admin' },
    ],
  },
  {
    key: 'orders',
    label: 'Đơn hàng',
    permissions: [
      { key: 'orders.view', label: 'Xem đơn hàng' },
      { key: 'orders.edit', label: 'Cập nhật trạng thái' },
      { key: 'orders.cancel', label: 'Hủy đơn' },
      { key: 'orders.refund', label: 'Hoàn tiền' },
    ],
  },
  {
    key: 'products',
    label: 'Sản phẩm',
    permissions: [
      { key: 'products.view', label: 'Xem sản phẩm' },
      { key: 'products.edit', label: 'Thêm/Sửa sản phẩm' },
      { key: 'products.delete', label: 'Xóa sản phẩm' },
    ],
  },
  {
    key: 'topups',
    label: 'Nạp tiền',
    permissions: [
      { key: 'topups.view', label: 'Xem giao dịch' },
      { key: 'topups.approve', label: 'Duyệt nạp tiền' },
      { key: 'topups.deduct', label: 'Trừ tiền' },
    ],
  },
  {
    key: 'coupons',
    label: 'Mã giảm giá',
    permissions: [
      { key: 'coupons.view', label: 'Xem mã giảm giá' },
      { key: 'coupons.edit', label: 'Tạo/Sửa mã' },
    ],
  },
  {
    key: 'bank',
    label: 'Ngân hàng & QR',
    permissions: [
      { key: 'bank.view', label: 'Xem cấu hình' },
      { key: 'bank.edit', label: 'Sửa cấu hình' },
    ],
  },
  {
    key: 'content',
    label: 'Nội dung',
    permissions: [
      { key: 'content.view', label: 'Xem nội dung' },
      { key: 'content.edit', label: 'Sửa nội dung site' },
    ],
  },
  {
    key: 'messages',
    label: 'Tin nhắn & Chat',
    permissions: [
      { key: 'messages.view', label: 'Xem tin nhắn' },
      { key: 'messages.reply', label: 'Trả lời' },
    ],
  },
  {
    key: 'logs',
    label: 'Nhật ký',
    permissions: [
      { key: 'logs.view', label: 'Xem nhật ký' },
      { key: 'logs.delete', label: 'Xóa nhật ký' },
    ],
  },
  {
    key: 'settings',
    label: 'Cài đặt',
    permissions: [
      { key: 'settings.view', label: 'Xem cài đặt' },
      { key: 'settings.edit', label: 'Sửa cài đặt' },
    ],
  },
  {
    key: 'roles',
    label: 'Vai trò',
    permissions: [
      { key: 'roles.view', label: 'Xem vai trò' },
      { key: 'roles.edit', label: 'Sửa vai trò & gán quyền' },
    ],
  },
  {
    key: 'affiliate',
    label: 'Affiliate',
    permissions: [
      { key: 'affiliate.view', label: 'Xem affiliate' },
      { key: 'affiliate.config', label: 'Cấu hình affiliate' },
      { key: 'affiliate.withdraw_approve', label: 'Duyệt rút tiền' },
    ],
  },
  {
    key: 'email',
    label: 'Email campaigns',
    permissions: [
      { key: 'email.view', label: 'Xem campaigns' },
      { key: 'email.send', label: 'Gửi campaign' },
      { key: 'email.config', label: 'Cấu hình SMTP' },
    ],
  },
  {
    key: 'automations',
    label: 'Tự động hóa',
    permissions: [
      { key: 'automations.view', label: 'Xem task' },
      { key: 'automations.edit', label: 'Tạo/Sửa task' },
    ],
  },
  {
    key: 'security',
    label: 'Bảo mật',
    permissions: [
      { key: 'security.view', label: 'Xem IP chặn + đăng nhập sai' },
      { key: 'security.ip_block_edit', label: 'Chặn/Bỏ chặn IP' },
    ],
  },
  {
    key: 'cron',
    label: 'Cron jobs',
    permissions: [
      { key: 'cron.view', label: 'Xem cron jobs' },
      { key: 'cron.edit', label: 'Chạy cron thủ công' },
    ],
  },
]

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_CATEGORIES.flatMap(
  (c) => c.permissions.map((p) => p.key),
)

export function isValidPermission(key: string): key is PermissionKey {
  return ALL_PERMISSIONS.includes(key as PermissionKey)
}
