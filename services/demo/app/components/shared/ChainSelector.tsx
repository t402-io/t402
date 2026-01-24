"use client";

import { useChainContext } from "@/providers/ChainProvider";
import { CHAIN_FAMILIES, CHAIN_CONFIGS, type ChainFamily } from "@/lib/testnet-config";
import { ChainLogo } from "./ChainLogo";
import clsx from "clsx";

export function ChainSelector({ compact = false }: { compact?: boolean }) {
  const { activeFamily, setActiveFamily } = useChainContext();

  return (
    <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Blockchain selection">
      {CHAIN_FAMILIES.map((family) => {
        const config = CHAIN_CONFIGS[family];
        const isActive = activeFamily === family;
        return (
          <button
            key={family}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveFamily(family)}
            className={clsx(
              "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              isActive
                ? "bg-[var(--color-surface-active)] text-white"
                : "text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-surface)]"
            )}
          >
            <ChainLogo family={family} size={14} />
            {!compact && <span>{config.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
