import { Skeleton } from '@/components/ui/skeleton'

export default function CategoryLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero skeleton */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-center gap-1.5 mb-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-8 sm:h-10 w-48" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-64 shrink-0 space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
          </aside>
          {/* Products */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between mb-4 pb-4 border-b border-border/50">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32 rounded-md" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border overflow-hidden">
                  <Skeleton className="aspect-[4/3] w-full" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-8 w-full rounded-lg mt-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
