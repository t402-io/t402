"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { CHAIN_FAMILIES, CHAIN_CONFIGS, type ChainFamily } from "@/lib/testnet-config";
import { getMainnetConfigsForFamily, getConfigByNetwork } from "@/lib/chain-registry";
import { chainIdFromCaip2 } from "@/lib/evm-chains";
import { ChainLogo } from "./ChainLogo";
import { ChevronDown, Loader2 } from "lucide-react";

// ─── Main ChainSelector (Popover) ───

export function ChainSelector({ compact = false }: { compact?: boolean }) {
  const {
    activeFamily, setActiveFamily, activeNetwork, setActiveNetwork,
    activeConfig, isPaymentInProgress, isSwitchingChain,
  } = useChainContext();
  const { testnet } = useDemoContext();

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const isDisabled = isPaymentInProgress;

  const handleSelectFamily = useCallback((family: ChainFamily) => {
    setActiveFamily(family);
    if (family !== "evm" || testnet) {
      setIsOpen(false);
    }
  }, [setActiveFamily, testnet]);

  const handleSelectNetwork = useCallback((network: string) => {
    setActiveNetwork(network);
    setIsOpen(false);
  }, [setActiveNetwork]);

  const config = CHAIN_CONFIGS[activeFamily];
  const displayName = activeConfig?.name || config.label;

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all min-h-[36px]"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-primary)",
          opacity: isDisabled ? 0.5 : 1,
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select blockchain"
      >
        {isSwitchingChain ? (
          <Loader2 size={14} className="animate-spin" style={{ color: config.color }} />
        ) : (
          <ChainLogo family={activeFamily} size={14} />
        )}
        <span className={compact ? "hidden sm:inline" : ""}>{compact ? config.label : displayName}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} style={{ color: "var(--color-text-tertiary)" }} />
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute top-full mt-2 right-0 sm:left-0 sm:right-auto z-50 w-[320px] sm:w-[360px] animate-slide-up"
          style={{
            background: "rgba(17, 17, 19, 0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "1rem",
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          }}
          role="listbox"
          aria-label="Blockchain networks"
        >
          {/* Chain Families Grid */}
          <div className="p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-2" style={{ color: "var(--color-text-tertiary)" }}>
              Network
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {CHAIN_FAMILIES.map((family) => {
                const cfg = CHAIN_CONFIGS[family];
                const isActive = activeFamily === family;
                return (
                  <button
                    key={family}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelectFamily(family)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all min-h-[40px]"
                    style={{
                      background: isActive ? `${cfg.color}15` : "transparent",
                      border: isActive ? `1px solid ${cfg.color}40` : "1px solid transparent",
                      color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                    }}
                  >
                    <ChainLogo family={family} size={18} />
                    <span className="truncate">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* EVM Sub-chains (mainnet only) */}
          {activeFamily === "evm" && !testnet && (
            <EvmSubChains
              activeNetwork={activeNetwork}
              onSelect={handleSelectNetwork}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── EVM Sub-Chain Panel ───

function EvmSubChains({ activeNetwork, onSelect }: { activeNetwork: string | null; onSelect: (network: string) => void }) {
  const evmChains = getMainnetConfigsForFamily("evm");
  const usdt0Chains = evmChains.filter((c) => c.scheme === "exact");
  const legacyChains = evmChains.filter((c) => c.scheme === "exact-legacy");

  return (
    <div className="border-t border-[rgba(255,255,255,0.06)] px-3 pb-3 pt-2">
      {/* USDT0 chains */}
      <p className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-1.5" style={{ color: "var(--color-text-tertiary)" }}>
        USDT0 <span className="normal-case tracking-normal opacity-60">· 1-step</span>
      </p>
      <div className="grid grid-cols-3 gap-1">
        {usdt0Chains.map((chain) => (
          <ChainPill key={chain.network} chain={chain} isActive={activeNetwork === chain.network} onClick={() => onSelect(chain.network)} />
        ))}
      </div>

      {/* Legacy USDT chains */}
      {legacyChains.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-[0.15em] font-semibold mt-2.5 mb-1.5" style={{ color: "var(--color-text-tertiary)" }}>
            Legacy USDT <span className="normal-case tracking-normal opacity-60">· 2-step</span>
          </p>
          <div className="grid grid-cols-3 gap-1">
            {legacyChains.map((chain) => (
              <ChainPill key={chain.network} chain={chain} isActive={activeNetwork === chain.network} onClick={() => onSelect(chain.network)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChainPill({ chain, isActive, onClick }: { chain: { network: string; name: string; color: string }; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all"
      style={{
        background: isActive ? chain.color + "18" : "transparent",
        color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
        border: isActive ? `1px solid ${chain.color}35` : "1px solid transparent",
        boxShadow: isActive ? `0 0 8px ${chain.color}15` : "none",
      }}
    >
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: chain.color }} />
      <span className="truncate">{chain.name}</span>
    </button>
  );
}

// ─── Chain Mismatch Banner (unchanged) ───

export function ChainMismatchBanner() {
  const {
    activeFamily, activeNetwork, isChainMatched, isSwitchingChain,
    walletChainName, ensureEvmChain, isPaymentInProgress,
  } = useChainContext();
  const { isDemo } = useDemoContext();

  if (activeFamily !== "evm" || isDemo || isChainMatched || !activeNetwork) return null;

  const expectedConfig = getConfigByNetwork(activeNetwork);
  const expectedName = expectedConfig?.name || activeNetwork;

  if (isSwitchingChain) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-2.5 px-4 text-xs"
        style={{ background: "rgba(59, 130, 246, 0.08)", color: "var(--color-info)" }}
      >
        <Loader2 size={14} className="animate-spin" />
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
      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium transition-colors hover:opacity-80"
      style={{ background: "rgba(245, 158, 11, 0.08)", color: "var(--color-warning)" }}
    >
      <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--color-warning)" }} />
      Wallet is on {walletChainName || "unknown chain"} — click to switch to {expectedName}
    </button>
  );
}
