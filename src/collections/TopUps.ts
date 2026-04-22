import type { CollectionConfig } from 'payload'
import type { User } from '@/types/payload-types'

export const TopUps: CollectionConfig = {
  slug: 'topups',
  admin: {
    useAsTitle: 'transferCode',
    group: 'Thương mại',
    defaultColumns: ['transferCode', 'user', 'amount', 'status', 'createdAt'],
    description: 'Lịch sử nạp tiền qua chuyển khoản ngân hàng',
    listSearchableFields: ['transferCode', 'bankTransactionId', 'bankDescription'],
  },
  labels: { singular: 'Nạp tiền', plural: 'Nạp tiền' },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) return { user: { equals: user.id } }
      return false
    },
    create: () => true,
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    afterChange: [
      async ({ operation, previousDoc, doc, req }) => {
        if (operation !== 'update') return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((req as any)?.context?.skipAutoCredit) return
        if (previousDoc?.status !== 'pending' || doc?.status !== 'completed') return
        if (previousDoc?.creditedAt || doc?.creditedAt) return

        const userId = typeof doc.user === 'object' ? doc.user.id : doc.user
        if (!userId) return

        const targetUser = await req.payload.findByID({ collection: 'users', id: userId }) as User
        if (!targetUser) return

        const creditAmount = Number(doc.amount)
        if (!creditAmount || creditAmount <= 0) return

        const currentBalance = targetUser.balance || 0

        await req.payload.update({
          collection: 'users',
          id: userId,
          data: { balance: currentBalance + creditAmount },
          overrideAccess: true,
        })

        await req.payload.update({
          collection: 'topups',
          id: doc.id,
          data: {
            creditedAt: new Date().toISOString(),
            confirmedAt: doc.confirmedAt || new Date().toISOString(),
          },
          overrideAccess: true,
          context: { skipAutoCredit: true },
        })

        try {
          const { accrueCommission } = await import('@/lib/affiliate')
          await accrueCommission({
            referredUserId: Number(userId),
            baseAmount: creditAmount,
            sourceType: 'topup',
            sourceId: String(doc.id),
          })
        } catch { /* non-fatal */ }

        try {
          const { revalidatePath } = await import('next/cache')
          revalidatePath('/', 'layout')
        } catch { /* non-fatal */ }
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Người dùng',
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 1000,
      label: 'Số tiền (VND)',
    },
    {
      name: 'transferCode',
      type: 'text',
      required: true,
      unique: true,
      label: 'Nội dung chuyển khoản',
      admin: { description: 'Mã nhận dạng giao dịch (VD: NAP1A2B3C)' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      label: 'Trạng thái',
      options: [
        { label: 'Chờ xác nhận', value: 'pending' },
        { label: 'Thành công', value: 'completed' },
        { label: 'Thất bại', value: 'failed' },
        { label: 'Hết hạn', value: 'expired' },
      ],
      admin: {
        description: 'Đổi sang "Thành công" để auto-cộng tiền vào ví user (nếu chưa cộng).',
      },
    },
    {
      name: 'bankTransactionId',
      type: 'text',
      label: 'Mã giao dịch ngân hàng',
      admin: { description: 'Mã giao dịch từ webhook ngân hàng (Sepay/Casso)' },
    },
    {
      name: 'bankDescription',
      type: 'text',
      label: 'Nội dung chuyển khoản gốc',
    },
    {
      name: 'confirmedAt',
      type: 'date',
      label: 'Ngày xác nhận',
    },
    {
      name: 'creditedAt',
      type: 'date',
      label: 'Ngày cộng tiền',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Tự động set khi hook cộng tiền vào ví. Nếu có giá trị → đã cộng, không cộng lại.',
      },
    },
    {
      name: 'readByAdmin',
      type: 'checkbox',
      defaultValue: false,
      label: 'Admin đã xem',
      admin: { position: 'sidebar' },
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: 'Hết hạn lúc',
      admin: { description: 'Giao dịch chờ hết hạn sau 30 phút' },
    },
  ],
}
