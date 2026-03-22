"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card p-8 max-w-md w-full text-center">
        <div
          className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ background: "rgba(239, 68, 68, 0.1)" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 6v4m0 4h.01M18 10a8 8 0 11-16 0 8 8 0 0116 0z" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm mb-1" style={{ color: "var(--color-muted)" }}>
          An unexpected error occurred while loading this page.
        </p>
        {error.digest && (
          <p className="text-xs font-mono mb-4" style={{ color: "var(--color-text-tertiary)" }}>
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="btn-primary px-5 py-3 text-sm min-h-[44px]"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-5 py-3 text-sm rounded-xl hover:text-white transition-colors min-h-[44px] flex items-center"
            style={{ border: "1px solid rgba(255, 255, 255, 0.15)", color: "var(--color-muted)" }}
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
