import Link from "next/link";

export function CTA() {
  return (
    <section className="section-light py-24 md:py-32">
      <div className="mx-auto max-w-editorial px-6">
        {/* Section mark */}
        <div className="mb-10 flex items-baseline justify-between">
          <span className="editorial-mark text-base md:text-lg">T402.03</span>
          <span className="eyebrow">Colophon</span>
        </div>

        <hr className="rule" />

        {/* Sign-off */}
        <div className="mt-16 mb-16 text-center md:mt-20 md:mb-20">
          <h2 className="font-serif text-4xl leading-[1.1] text-[var(--color-foreground)] md:text-6xl">
            Start building.
          </h2>

          <p className="mx-auto mt-8 max-w-xl text-base leading-[1.65] text-[var(--color-foreground-secondary)] md:text-lg">
            Open-source HTTP payment protocol. Wire-compatible with x402,
            plus authCapture, dispute, and USDT-on-TRON. Self-host the
            facilitator or use t402 Pay.
          </p>

          <div className="mt-12 flex flex-col items-center justify-center gap-6 md:flex-row md:gap-10">
            <Link
              href="https://docs.t402.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-serif text-lg italic text-[var(--color-foreground)] underline decoration-[var(--color-brand)] decoration-2 underline-offset-[6px] transition-colors hover:text-[var(--color-brand)]"
            >
              Read the docs →
            </Link>
            <Link
              href="https://github.com/t402-io/t402"
              target="_blank"
              rel="noopener noreferrer"
              className="font-serif text-lg italic text-[var(--color-foreground-secondary)] transition-colors hover:text-[var(--color-foreground)]"
            >
              View on GitHub →
            </Link>
          </div>
        </div>

        <hr className="rule" />

        {/* Trust line */}
        <p className="mt-8 text-center text-sm text-[var(--color-foreground-tertiary)]">
          <span className="eyebrow">Apache 2.0</span>
          <span aria-hidden className="mx-3">
            ·
          </span>
          <span className="eyebrow">x402-compatible</span>
          <span aria-hidden className="mx-3">
            ·
          </span>
          <span className="eyebrow">WDK-compatible</span>
        </p>
      </div>
    </section>
  );
}
