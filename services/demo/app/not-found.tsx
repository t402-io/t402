import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <span className="text-6xl font-bold" style={{ color: "var(--color-brand)", opacity: 0.3 }}>402</span>
          <p className="text-lg font-semibold mt-2">Page Not Found</p>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            This resource doesn&apos;t exist — and no payment will fix that.
          </p>
        </div>

        <div
          className="rounded-2xl p-3 sm:p-4 mb-6 text-left font-mono text-[11px] sm:text-xs overflow-x-auto"
          style={{ background: "var(--color-surface)", border: "1px solid rgba(255, 255, 255, 0.08)" }}
        >
          <div style={{ color: "var(--color-muted)" }}>
            <span style={{ color: "#EF4444" }}>GET</span> /unknown-page
          </div>
          <div className="mt-1.5">
            <span style={{ color: "#F59E0B" }}>404</span>{" "}
            <span style={{ color: "var(--color-muted)" }}>Not Found</span>
          </div>
          <div className="mt-1.5" style={{ color: "var(--color-text-tertiary)" }}>
            — no matching route
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
          <Link href="/" className="btn-primary px-5 py-3 text-sm min-h-[44px] flex items-center">
            Go home
          </Link>
          <Link
            href="/ai-api"
            className="px-5 py-3 text-sm rounded-xl hover:text-white transition-colors min-h-[44px] flex items-center"
            style={{ border: "1px solid rgba(255, 255, 255, 0.15)", color: "var(--color-muted)" }}
          >
            Try a scenario
          </Link>
        </div>
      </div>
    </div>
  );
}
