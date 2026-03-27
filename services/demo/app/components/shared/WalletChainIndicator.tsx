"use client";

import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { getEvmChainName, chainIdFromCaip2 } from "@/lib/evm-chains";
import { Loader2 } from "lucide-react";

interface WalletChainIndicatorProps {
  /** Override expected chain ID (for DexSwap/Bridge local chain state). If omitted, reads from ChainProvider. */
  expectedChainId?: number;
  compact?: boolean;
}

export function WalletChainIndicator({ expectedChainId, compact }: WalletChainIndicatorProps) {
  const {
    activeFamily,
    activeNetwork,
    walletChainId,
    walletChainName,
    isSwitchingChain,
    chainSwitchError,
    ensureEvmChain,
  } = useChainContext();
  const { isDemo } = useDemoContext();

  // Only render for EVM in live mode with connected wallet
  if (activeFamily !== "evm" || isDemo || !walletChainId) return null;

  const expected = expectedChainId ?? chainIdFromCaip2(activeNetwork);
  const expectedName = expected ? getEvmChainName(expected) : null;
  const isMatched = !expected || walletChainId === expected;

  // Switching state
  if (isSwitchingChain) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
        <Loader2 size={12} className="animate-spin" />
        {!compact && <span>Switching to {expectedName || "..."}...</span>}
      </div>
    );
  }

  // Matched
  if (isMatched) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {!compact && <span>{walletChainName || getEvmChainName(walletChainId)}</span>}
      </div>
    );
  }

  // Mismatch
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      {compact ? (
        <button
          onClick={() => expected && ensureEvmChain(expected)}
          className="text-red-400 hover:text-red-300 underline underline-offset-2"
          title={`Wallet on ${walletChainName}, expected ${expectedName}`}
        >
          Switch
        </button>
      ) : (
        <>
          <span className="text-red-400">
            Wallet on {walletChainName || getEvmChainName(walletChainId)}, expected {expectedName}
          </span>
          <button
            onClick={() => expected && ensureEvmChain(expected)}
            className="text-[10px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors"
          >
            Switch
          </button>
        </>
      )}
      {chainSwitchError && (
        <span className="text-[10px] text-red-400/70">{chainSwitchError}</span>
      )}
    </div>
  );
}
