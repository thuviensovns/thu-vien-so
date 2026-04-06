import type { Metadata } from 'next'
import { ContactContent } from './ContactContent'

export const metadata: Metadata = {
  title: 'Liên hệ',
  description: 'Liên hệ với Thư Viện Số - Hỗ trợ kỹ thuật, tư vấn sản phẩm',
}

export default function ContactPage() {
  return <ContactContent />
}
