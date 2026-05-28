"use client";

import { CHAIN_FAMILIES } from "../data/constants";

export function ChainLogoBar() {
  // Duplicate for seamless marquee loop
  const items = [...CHAIN_FAMILIES, ...CHAIN_FAMILIES];

  return (
    <section
      className="section-light overflow-hidden border-y"
      style={{ borderColor: "var(--color-rule-soft)" }}
    >
      <div
        className="flex items-center whitespace-nowrap py-4"
        style={{ animation: "marquee 45s linear infinite", width: "max-content" }}
      >
        {items.map((family, i) => (
          <span
            key={`${family.name}-${i}`}
            className="flex items-center gap-3 px-5 font-serif text-base italic text-[var(--color-foreground-secondary)]"
          >
            {family.name.toLowerCase()}
            <span aria-hidden className="text-[var(--color-foreground-tertiary)]">
              ·
            </span>
          </span>
        ))}
      </div>

      <style jsx>{`
        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
