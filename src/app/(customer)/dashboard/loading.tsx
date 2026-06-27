import { Skeleton } from '@/components/ui/Skeleton';

/** Route-level skeleton shown while the dashboard's bookings query resolves. */
export default function DashboardLoading() {
  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-3 h-4 w-72" />
      </div>

      {/* Tab strip */}
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-full" />
        ))}
      </div>

      {/* Booking cards */}
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-16 w-full rounded-xl" />
            <Skeleton className="mt-4 h-24 w-full rounded-xl" />
            <Skeleton className="mt-4 h-12 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
