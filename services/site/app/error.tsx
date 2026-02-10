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
    <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-10">
          <span className="text-8xl font-bold text-[#EF4444]/20">500</span>
          <h1 className="text-2xl font-bold mt-4 text-white">
            Something went wrong
          </h1>
          <p className="text-[#A1A1AA] mt-3 text-base">
            An unexpected error occurred. This has been logged for investigation.
          </p>
        </div>

        {error.digest && (
          <div className="rounded-xl border border-[#27272A] bg-[#111113] p-4 mb-8 text-left font-mono text-sm text-[#71717A]">
            Digest: {error.digest}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center rounded-xl bg-[#50AF95] px-6 py-3 text-sm font-semibold text-[#0A0A0B] transition-colors hover:bg-[#26A17B] cursor-pointer"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-[#27272A] bg-[#111113] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#18181B]"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
