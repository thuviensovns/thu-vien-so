import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <FileQuestion className="h-20 w-20 text-muted-foreground mb-6" />
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-xl text-muted-foreground mt-2">Trang không tồn tại</p>
      <p className="text-sm text-muted-foreground mt-1">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/">Về trang chủ</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/san-pham">Xem sản phẩm</Link>
        </Button>
      </div>
    </div>
  )
}
