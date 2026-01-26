export default function ScenariosLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-10">
      {/* Title skeleton */}
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
          <div className="h-6 w-28 sm:w-32 rounded-md bg-[var(--color-surface-hover)] animate-pulse" />
          <div className="h-5 w-16 sm:w-20 rounded-full bg-[var(--color-surface-hover)] animate-pulse" />
        </div>
        <div className="h-4 w-full max-w-[280px] sm:max-w-[320px] rounded-md bg-[var(--color-surface-hover)] animate-pulse mb-6" />

        {/* Flow diagram skeleton - show fewer items on mobile */}
        <div className="glass-card p-3 sm:p-4 mb-6">
          <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 sm:gap-1.5 shrink-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[var(--color-surface-hover)] animate-pulse" />
                <div className="h-2 w-8 sm:h-2.5 sm:w-10 rounded bg-[var(--color-surface-hover)] animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Content skeleton */}
        <div className="glass-card p-4 sm:p-6">
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-[var(--color-surface-hover)] animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-[var(--color-surface-hover)] animate-pulse" />
            <div className="h-4 w-4/6 rounded bg-[var(--color-surface-hover)] animate-pulse" />
          </div>
          <div className="mt-6 flex justify-center">
            <div className="h-11 w-36 sm:w-40 rounded-lg bg-[var(--color-surface-hover)] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
