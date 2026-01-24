"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <span className="text-8xl font-bold text-error/30">500</span>
          <h1 className="text-2xl font-bold mt-4">Something Went Wrong</h1>
          <p className="text-foreground-secondary mt-2">
            An unexpected error occurred. This has been logged for investigation.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background-secondary p-5 mb-8 text-left font-mono text-sm">
          <div className="text-foreground-tertiary">
            <span className="text-error">ERROR</span>{" "}
            <span className="text-foreground-secondary">Internal Server Error</span>
          </div>
          {error.digest && (
            <div className="mt-2 text-foreground-tertiary/60">
              Digest: {error.digest}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium transition-colors hover:bg-brand-secondary cursor-pointer"
            style={{ color: "#0A0A0B" }}
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-border bg-background-tertiary px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-border"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
