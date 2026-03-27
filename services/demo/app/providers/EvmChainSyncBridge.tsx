"use client";

import { useEffect, useRef } from "react";
import { useChainContext } from "./ChainProvider";
import { useEvmChainSync } from "@/hooks/useEvmChainSync";
import { chainIdFromCaip2 } from "@/lib/evm-chains";

/**
 * Bridge component that lives inside WagmiProvider and syncs
 * wallet chain state into ChainProvider.
 *
 * - Pushes wallet state (walletChainId, isSwitching, etc.) into ChainProvider
 * - Auto-switches wallet when activeNetwork changes to an EVM network
 * - Awaits the switch to completion (no fire-and-forget)
 * - Skips if already switching to the same chain
 * - Renders nothing — pure side-effect component
 */
export function EvmChainSyncBridge() {
  const { activeFamily, activeNetwork, setEvmWalletState } = useChainContext();
  const sync = useEvmChainSync();

  // Push wallet state into ChainProvider whenever it changes
  useEffect(() => {
    setEvmWalletState({
      walletChainId: sync.walletChainId,
      walletChainName: sync.walletChainName,
      isSwitching: sync.isSwitching,
      switchError: sync.switchError,
      ensureChain: sync.ensureChain,
    });
  }, [sync.walletChainId, sync.walletChainName, sync.isSwitching, sync.switchError, sync.ensureChain, setEvmWalletState]);

  // Auto-switch wallet when user selects a different EVM network
  const prevNetworkRef = useRef<string | null>(null);
  const switchingRef = useRef(false); // Prevent concurrent auto-switches

  useEffect(() => {
    if (activeFamily !== "evm") return;
    if (!activeNetwork) return;
    // Only switch if the network actually changed (not on initial mount)
    if (prevNetworkRef.current === activeNetwork) return;
    prevNetworkRef.current = activeNetwork;

    const chainId = chainIdFromCaip2(activeNetwork);
    if (!chainId || chainId === sync.walletChainId) return;

    // Skip if already switching (prevents race condition)
    if (switchingRef.current) return;

    // Awaitable switch — not fire-and-forget
    switchingRef.current = true;
    sync.ensureChain(chainId).finally(() => {
      switchingRef.current = false;
    });
  }, [activeFamily, activeNetwork, sync.walletChainId, sync.ensureChain]);

  return null;
}
