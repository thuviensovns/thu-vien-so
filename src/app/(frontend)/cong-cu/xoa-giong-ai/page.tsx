import type { Metadata } from 'next'
import { VocalRemover } from '@/components/vocal-remover/VocalRemover'

export const metadata: Metadata = {
  title: 'Xóa Giọng Hát AI — Tách Vocal & Nhạc Nền',
  description:
    'Công cụ xóa giọng hát và tách nhạc nền miễn phí. Tách vocal, lấy beat karaoke từ bài hát. Xử lý trực tiếp trên trình duyệt, không cần cài phần mềm.',
}

export default function XoaGiongAiPage() {
  return (
    <main className="container max-w-4xl mx-auto py-8 px-4">
      <VocalRemover />
    </main>
  )
}
