export default function Loading() {
  return (
    <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto animate-pulse">
      {/* Accent line skeleton */}
      <div className="h-0.5 w-16 rounded-full mb-8 bg-[var(--color-border)]" />
      {/* Title skeleton */}
      <div className="h-8 w-64 rounded bg-[var(--color-border)] mb-4" />
      <div className="h-4 w-96 rounded bg-[var(--color-border)] mb-6 opacity-50" />
      {/* Chain selector skeleton */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-16 rounded-xl bg-[var(--color-border)] opacity-30" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-48 rounded-xl bg-[var(--color-border)] opacity-20" />
        <div className="h-48 rounded-xl bg-[var(--color-border)] opacity-20" />
      </div>
    </div>
  );
}
