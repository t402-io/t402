import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <span className="text-6xl font-bold text-[var(--color-brand)] opacity-30">402</span>
          <p className="text-lg font-semibold mt-2">Page Not Found</p>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            This resource doesn&apos;t exist — and no payment will fix that.
          </p>
        </div>

        <div className="glass-card p-3 sm:p-4 mb-6 text-left font-mono text-[11px] sm:text-xs overflow-x-auto">
          <div className="text-[var(--color-muted)]">
            <span className="text-[var(--color-error)]">GET</span> /unknown-page
          </div>
          <div className="mt-1.5">
            <span className="text-[var(--color-warning)]">404</span>{" "}
            <span className="text-[var(--color-muted)]">Not Found</span>
          </div>
          <div className="mt-1.5 text-[var(--color-muted)] opacity-60">
            — no matching route
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
          <Link href="/" className="btn-primary px-5 py-3 text-sm min-h-[44px] flex items-center">
            Go home
          </Link>
          <Link
            href="/ai-api"
            className="px-5 py-3 text-sm border border-[var(--color-border)] rounded-lg text-[var(--color-muted)] hover:text-white transition-colors min-h-[44px] flex items-center"
          >
            Try a scenario
          </Link>
        </div>
      </div>
    </div>
  );
}
