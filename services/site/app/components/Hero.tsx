import Link from "next/link";

export function Hero() {
  return (
    <section className="section-light pt-32 pb-24 md:pt-44 md:pb-32">
      <div className="mx-auto max-w-editorial px-6">
        {/* T402 mark */}
        <div className="mb-12 flex items-center justify-between text-[var(--color-foreground-secondary)]">
          <span className="editorial-mark text-base md:text-lg">T402</span>
          <span className="eyebrow">Volume 02 · Specification</span>
        </div>

        {/* Top rule */}
        <hr className="rule" />

        {/* Headline */}
        <h1 className="mt-12 mb-8 text-balance font-serif text-[2.75rem] leading-[1.05] tracking-[-0.02em] text-[var(--color-foreground)] md:mt-16 md:mb-10 md:text-[4.5rem] lg:text-[5.5rem]">
          The Stablecoin
          <br />
          Payment Protocol
          <br />
          for the Internet.
        </h1>

        {/* Bottom rule */}
        <hr className="rule" />

        {/* Subtitle + meta */}
        <div className="mt-10 grid gap-12 md:mt-14 md:grid-cols-12">
          <p className="text-balance text-base leading-[1.65] text-[var(--color-foreground-secondary)] md:col-span-7 md:text-lg">
            An open HTTP-native payment protocol. Wire-compatible with x402,
            plus the authCapture + dispute layer and USDT-on-TRON.
            Compatible with Tether&apos;s open-source WDK. Built for AI agents.
          </p>

          <dl className="space-y-3 text-sm md:col-span-5">
            <div className="flex items-baseline justify-between border-b border-[var(--color-rule-soft)] pb-2">
              <dt className="eyebrow">Networks</dt>
              <dd className="font-serif text-base text-[var(--color-foreground)]">47</dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-[var(--color-rule-soft)] pb-2">
              <dt className="eyebrow">Kinds</dt>
              <dd className="font-serif text-base text-[var(--color-foreground)]">71</dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-[var(--color-rule-soft)] pb-2">
              <dt className="eyebrow">SDKs</dt>
              <dd className="font-serif text-base italic text-[var(--color-foreground)]">
                TS · Go · Py · Java
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-[var(--color-rule-soft)] pb-2">
              <dt className="eyebrow">Protocol fees</dt>
              <dd className="font-serif text-base text-[var(--color-foreground)]">$0.00</dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-[var(--color-rule-soft)] pb-2">
              <dt className="eyebrow">License</dt>
              <dd className="font-serif text-base text-[var(--color-foreground)]">Apache 2.0</dd>
            </div>
          </dl>
        </div>

        {/* CTAs */}
        <div className="mt-14 flex flex-col items-start gap-6 md:flex-row md:items-baseline md:gap-10">
          <Link
            href="https://docs.t402.io/getting-started/quickstart"
            target="_blank"
            rel="noopener noreferrer"
            className="font-serif text-lg italic text-[var(--color-foreground)] underline decoration-[var(--color-brand)] decoration-2 underline-offset-[6px] transition-colors hover:text-[var(--color-brand)]"
          >
            Read the specification →
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
    </section>
  );
}
