export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--color-border)]" />
          <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-transparent border-t-[var(--color-brand)] animate-spin" />
        </div>
        <p className="text-sm text-[var(--color-muted)]">Loading...</p>
      </div>
    </div>
  );
}
