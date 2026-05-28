import Link from "next/link";
import { NavBar } from "./components/NavBar";
import { Footer } from "./components/Footer";

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--color-background)", color: "var(--color-foreground)" }}
    >
      <NavBar />

      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-editorial w-full">
          <div className="mb-10 flex items-baseline justify-between text-[var(--color-foreground-secondary)]">
            <span className="editorial-mark text-base md:text-lg">N° 404</span>
            <span className="eyebrow">Page not found</span>
          </div>

          <hr className="rule" />

          <h1 className="mt-12 mb-8 font-serif text-[3rem] leading-[1.05] text-[var(--color-foreground)] md:text-[5rem]">
            Page not found.
          </h1>

          <hr className="rule" />

          <p className="mt-10 max-w-xl text-base leading-[1.65] text-[var(--color-foreground-secondary)] md:text-lg">
            This resource doesn&apos;t exist — but if it did, you could pay for it.
          </p>

          <div className="mt-12 flex flex-col items-start gap-6 md:flex-row md:items-baseline md:gap-10">
            <Link
              href="/"
              className="font-serif text-lg italic text-[var(--color-foreground)] underline decoration-[var(--color-brand)] decoration-2 underline-offset-[6px] transition-colors hover:text-[var(--color-brand)]"
            >
              Return home →
            </Link>
            <Link
              href="/sdks"
              className="font-serif text-lg italic text-[var(--color-foreground-secondary)] transition-colors hover:text-[var(--color-foreground)]"
            >
              View SDKs →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
