export default function ScenariosLoading() {
  return (
    <div className="p-6 sm:p-8 lg:p-10">
      {/* Title skeleton */}
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-5 w-32 rounded-md bg-[var(--color-surface-hover)] animate-pulse" />
          <div className="h-4 w-20 rounded-full bg-[var(--color-surface-hover)] animate-pulse" />
        </div>
        <div className="h-4 w-80 rounded-md bg-[var(--color-surface-hover)] animate-pulse mb-6" />

        {/* Flow diagram skeleton */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center justify-between gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-[var(--color-surface-hover)] animate-pulse" />
                <div className="h-2.5 w-10 rounded bg-[var(--color-surface-hover)] animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Content skeleton */}
        <div className="glass-card p-6">
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-[var(--color-surface-hover)] animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-[var(--color-surface-hover)] animate-pulse" />
            <div className="h-4 w-4/6 rounded bg-[var(--color-surface-hover)] animate-pulse" />
          </div>
          <div className="mt-6 flex justify-center">
            <div className="h-10 w-40 rounded-lg bg-[var(--color-surface-hover)] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
