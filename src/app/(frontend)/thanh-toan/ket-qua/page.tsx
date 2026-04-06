import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import PaymentResultContent from './PaymentResultContent'

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto flex items-center justify-center min-h-[60vh] px-4">
          <Card className="w-full max-w-md border-border bg-card text-center">
            <CardContent className="p-8">
              <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
              <h1 className="text-xl font-bold">Đang xử lý thanh toán...</h1>
              <p className="text-sm text-muted-foreground mt-2">Vui lòng chờ trong giây lát</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  )
}
