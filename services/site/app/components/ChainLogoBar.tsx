"use client";

import { CHAIN_FAMILIES } from "../data/constants";

export function ChainLogoBar() {
  // Duplicate items for seamless loop
  const items = [...CHAIN_FAMILIES, ...CHAIN_FAMILIES];

  return (
    <section className="section-light-alt border-y border-[var(--border-light)] py-6">
      <div className="overflow-hidden">
        <div
          className="flex items-center gap-12"
          style={{
            animation: "marquee 30s linear infinite",
            width: "max-content",
          }}
        >
          {items.map((family, i) => (
            <div key={`${family.name}-${i}`} className="flex items-center gap-3 whitespace-nowrap">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: family.color }}
              />
              <span className="text-sm font-medium text-[var(--text-on-light-secondary)]">
                {family.name}
              </span>
              <span className="text-xs text-[var(--text-on-light-tertiary)]">
                {family.count} networks
              </span>
            </div>
          ))}
        </div>
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
