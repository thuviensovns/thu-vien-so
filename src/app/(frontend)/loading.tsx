import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      {/* Hero skeleton */}
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-12 sm:py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center space-y-4">
            <Skeleton className="h-6 w-48 mx-auto rounded-full" />
            <Skeleton className="h-10 sm:h-14 w-full max-w-md mx-auto" />
            <Skeleton className="h-5 w-full max-w-lg mx-auto" />
            <div className="flex justify-center gap-3 pt-4">
              <Skeleton className="h-10 w-36 rounded-md" />
              <Skeleton className="h-10 w-36 rounded-md" />
            </div>
          </div>
          {/* Stats skeleton */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
      </section>

      {/* Categories skeleton */}
      <section className="container mx-auto px-4 py-10 sm:py-14">
        <div className="flex justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </section>

      {/* Products skeleton */}
      <section className="container mx-auto px-4 py-10">
        <div className="flex justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
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
      </section>
    </>
  )
}
