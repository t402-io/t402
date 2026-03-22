"use client";

import { useChainContext } from "@/providers/ChainProvider";
import { CHAIN_FAMILIES, CHAIN_CONFIGS, type ChainFamily } from "@/lib/testnet-config";
import { ChainLogo } from "./ChainLogo";
import clsx from "clsx";

export function ChainSelector({ compact = false }: { compact?: boolean }) {
  const { activeFamily, setActiveFamily } = useChainContext();

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Blockchain selection">
      {CHAIN_FAMILIES.map((family) => {
        const config = CHAIN_CONFIGS[family];
        const isActive = activeFamily === family;
        return (
          <button
            key={family}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveFamily(family)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[36px]"
            style={{
              background: isActive ? "var(--color-surface-active)" : "transparent",
              color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              borderLeft: isActive ? `2px solid ${config.color}` : "2px solid transparent",
            }}
          >
            <ChainLogo family={family} size={14} />
            {!compact && <span>{config.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
