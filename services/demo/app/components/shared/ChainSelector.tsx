"use client";

import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { CHAIN_FAMILIES, CHAIN_CONFIGS, type ChainFamily } from "@/lib/testnet-config";
import { getMainnetConfigsForFamily } from "@/lib/chain-registry";
import { ChainLogo } from "./ChainLogo";

export function ChainSelector({ compact = false }: { compact?: boolean }) {
  const { activeFamily, setActiveFamily, activeNetwork, setActiveNetwork } = useChainContext();
  const { testnet } = useDemoContext();

  // In mainnet mode, EVM has multiple chains
  const evmMainnetChains = !testnet ? getMainnetConfigsForFamily("evm") : [];
  // Only show sub-chains in non-compact mode (i.e., NOT in the header)
  const showEvmSubChains = !compact && !testnet && activeFamily === "evm" && evmMainnetChains.length > 1;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Family tabs */}
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
      {/* EVM sub-chain selector (mainnet, non-compact only) */}
      {showEvmSubChains && (
        <div className="flex flex-wrap items-center gap-1 pl-1 max-w-full">
          {evmMainnetChains.map((chain) => {
            const isActive = activeNetwork === chain.network;
            return (
              <button
                key={chain.network}
                onClick={() => setActiveNetwork(chain.network)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all"
                style={{
                  background: isActive ? chain.color + "20" : "transparent",
                  color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  border: isActive ? `1px solid ${chain.color}40` : "1px solid transparent",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: chain.color }}
                />
                {chain.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
