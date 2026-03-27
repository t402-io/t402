"use client";

import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { CHAIN_FAMILIES, CHAIN_CONFIGS, type ChainFamily } from "@/lib/testnet-config";
import { getMainnetConfigsForFamily, getConfigByNetwork } from "@/lib/chain-registry";
import { chainIdFromCaip2 } from "@/lib/evm-chains";
import { ChainLogo } from "./ChainLogo";

export function ChainSelector({ compact = false }: { compact?: boolean }) {
  const {
    activeFamily, setActiveFamily, activeNetwork, setActiveNetwork,
    isPaymentInProgress, isSwitchingChain,
  } = useChainContext();
  const { testnet } = useDemoContext();

  const evmMainnetChains = !testnet ? getMainnetConfigsForFamily("evm") : [];
  const showEvmSubChains = !compact && !testnet && activeFamily === "evm" && evmMainnetChains.length > 1;

  // Split EVM chains into USDT0 (exact) and Legacy USDT (exact-legacy)
  const usdt0Chains = evmMainnetChains.filter((c) => c.scheme === "exact");
  const legacyChains = evmMainnetChains.filter((c) => c.scheme === "exact-legacy");

  // Disable all interactions during payment or chain switching
  const isDisabled = isPaymentInProgress || isSwitchingChain;

  return (
    <div className={`flex flex-col gap-1.5 ${isDisabled ? "opacity-60 pointer-events-none" : ""}`}>
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
              aria-disabled={isDisabled}
              disabled={isDisabled}
              onClick={() => setActiveFamily(family)}
              className="shrink-0 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-medium transition-all min-h-[36px]"
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
        <div className="flex flex-col gap-1 pl-1">
          {/* USDT0 chains — one-step payment */}
          <div className="flex flex-wrap items-center gap-0.5">
            <span className="text-[8px] text-[var(--color-muted)] mr-1 shrink-0">USDT0</span>
            {usdt0Chains.map((chain) => (
              <EvmChainPill
                key={chain.network}
                chain={chain}
                isActive={activeNetwork === chain.network}
                onClick={() => setActiveNetwork(chain.network)}
                disabled={isDisabled}
              />
            ))}
          </div>
          {/* Legacy USDT chains — needs approve */}
          {legacyChains.length > 0 && (
            <div className="flex flex-wrap items-center gap-0.5">
              <span className="text-[8px] text-[var(--color-muted)] mr-1 shrink-0">Legacy</span>
              {legacyChains.map((chain) => (
                <EvmChainPill
                  key={chain.network}
                  chain={chain}
                  isActive={activeNetwork === chain.network}
                  onClick={() => setActiveNetwork(chain.network)}
                  disabled={isDisabled}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline chain mismatch warning banner — shown in layout when wallet is on wrong chain.
 */
export function ChainMismatchBanner() {
  const {
    activeFamily, activeNetwork, isChainMatched, isSwitchingChain,
    walletChainName, ensureEvmChain, isPaymentInProgress,
  } = useChainContext();
  const { isDemo } = useDemoContext();

  // Only show for EVM, live mode, when mismatched
  if (activeFamily !== "evm" || isDemo || isChainMatched || !activeNetwork) return null;

  // Get expected chain name
  const expectedConfig = getConfigByNetwork(activeNetwork);
  const expectedName = expectedConfig?.name || activeNetwork;

  if (isSwitchingChain) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-2 px-4 text-xs"
        style={{ background: "rgba(59, 130, 246, 0.1)", color: "var(--color-info)" }}
      >
        <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        Switching to {expectedName}...
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        const chainId = chainIdFromCaip2(activeNetwork);
        if (chainId) ensureEvmChain(chainId);
      }}
      disabled={isPaymentInProgress}
      className="w-full flex items-center justify-center gap-2 py-2 px-4 text-xs transition-colors hover:opacity-80"
      style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--color-warning)" }}
    >
      <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--color-warning)" }} />
      Wallet is on {walletChainName || "unknown chain"} — click to switch to {expectedName}
    </button>
  );
}

function EvmChainPill({
  chain,
  isActive,
  onClick,
  disabled,
}: {
  chain: { network: string; name: string; color: string };
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all"
      style={{
        background: isActive ? chain.color + "20" : "transparent",
        color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
        border: isActive ? `1px solid ${chain.color}40` : "1px solid transparent",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: chain.color }} />
      {chain.name}
    </button>
  );
}
