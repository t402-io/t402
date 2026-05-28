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
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: "var(--color-background)", color: "var(--color-foreground)" }}
    >
      <div className="mx-auto max-w-editorial w-full">
        <div className="mb-10 flex items-baseline justify-between text-[var(--color-foreground-secondary)]">
          <span className="editorial-mark text-base md:text-lg">T402.500</span>
          <span className="eyebrow">Errata</span>
        </div>

        <hr className="rule" />

        <h1 className="mt-12 mb-8 font-serif text-4xl leading-[1.1] text-[var(--color-foreground)] md:text-5xl">
          Something went wrong.
        </h1>

        <hr className="rule" />

        <p className="mt-10 max-w-xl text-base leading-[1.65] text-[var(--color-foreground-secondary)] md:text-lg">
          An unexpected error occurred. This has been logged for investigation.
        </p>

        {error.digest && (
          <p
            className="mt-6 font-mono text-sm text-[var(--color-foreground-tertiary)]"
            style={{ borderLeft: "2px solid var(--color-rule-soft)", paddingLeft: "1rem" }}
          >
            Digest: {error.digest}
          </p>
        )}

        <div className="mt-10 flex flex-col items-start gap-6 md:flex-row md:items-baseline md:gap-10">
          <button
            onClick={reset}
            className="cursor-pointer font-serif text-lg italic text-[var(--color-foreground)] underline decoration-[var(--color-brand)] decoration-2 underline-offset-[6px] transition-colors hover:text-[var(--color-brand)]"
          >
            Try again →
          </button>
          <Link
            href="/"
            className="font-serif text-lg italic text-[var(--color-foreground-secondary)] transition-colors hover:text-[var(--color-foreground)]"
          >
            Return home →
          </Link>
        </div>
      </div>
    </div>
  );
}
