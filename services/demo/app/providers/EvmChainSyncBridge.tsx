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
 * - Renders nothing — pure side-effect component
 */
export function EvmChainSyncBridge() {
  const { activeFamily, activeNetwork, setEvmWalletState } = useChainContext();
  const { walletChainId, walletChainName, isSwitching, switchError, ensureChain } = useEvmChainSync();

  // Push wallet state into ChainProvider whenever it changes
  useEffect(() => {
    setEvmWalletState({
      walletChainId,
      walletChainName,
      isSwitching,
      switchError,
      ensureChain,
    });
  }, [walletChainId, walletChainName, isSwitching, switchError, ensureChain, setEvmWalletState]);

  // Auto-switch wallet when user selects a different EVM network
  const prevNetworkRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeFamily !== "evm") return;
    if (!activeNetwork) return;
    // Only switch if the network actually changed (not on initial mount)
    if (prevNetworkRef.current === activeNetwork) return;
    prevNetworkRef.current = activeNetwork;

    const chainId = chainIdFromCaip2(activeNetwork);
    if (chainId && chainId !== walletChainId) {
      ensureChain(chainId);
    }
  }, [activeFamily, activeNetwork, walletChainId, ensureChain]);

  return null;
}
