/** Grey placeholder shapes shown while data loads (they shimmer unless reduced motion is on). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-lg ${className}`} />;
}

/** A labelled loading region made of skeleton blocks. */
export function SkeletonGroup({
  label = 'Loading…',
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonCards({ count = 3, label }: { count?: number; label?: string }) {
  return (
    <SkeletonGroup label={label}>
      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

export function SkeletonTable({ rows = 6, label }: { rows?: number; label?: string }) {
  return (
    <SkeletonGroup label={label}>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <Skeleton className="h-4 w-1/3" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0"
          >
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
            <Skeleton className="hidden h-4 w-24 md:block" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
