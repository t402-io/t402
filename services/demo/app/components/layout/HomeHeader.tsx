"use client";

import { WalletButton } from "@/components/layout/WalletButton";
import { ModeToggle } from "@/components/layout/ModeToggle";
import { FacilitatorBadge } from "@/components/layout/FacilitatorBadge";

export function HomeHeader() {
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl"
      style={{
        background: "rgba(10, 10, 11, 0.85)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow: "0 1px 0 rgba(80, 175, 149, 0.08)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-base font-bold tracking-tight" style={{ color: "var(--color-brand)" }}>T402</span>
          <span className="hidden sm:inline text-xs font-medium" style={{ color: "var(--color-text-tertiary)" }}>demo</span>
          <div className="hidden sm:block">
            <FacilitatorBadge />
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ModeToggle />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
