"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { EVM_CHAIN_RPC, EVM_NATIVE_CURRENCY, getEvmChainName } from "@/lib/evm-chains";
import { getConfigByNetwork } from "@/lib/chain-registry";

export interface EvmChainSyncResult {
  /** Wallet's current EVM chain ID */
  walletChainId: number | undefined;
  /** Wallet's current chain name */
  walletChainName: string | undefined;
  /** True while a switchChain call is in-flight */
  isSwitching: boolean;
  /** Last switch error message, cleared on next attempt */
  switchError: string | null;
  /** Switch wallet to a specific EVM chain ID. Returns true on success. */
  ensureChain: (chainId: number) => Promise<boolean>;
}

export function useEvmChainSync(): EvmChainSyncResult {
  const { chain, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Version counter to handle rapid successive switches
  const versionRef = useRef(0);

  const ensureChain = useCallback(
    async (chainId: number): Promise<boolean> => {
      // Already on correct chain
      if (chain?.id === chainId) {
        setSwitchError(null);
        return true;
      }

      // Wallet not connected — can't switch
      if (!isConnected || !switchChainAsync) {
        return false;
      }

      const version = ++versionRef.current;
      setIsSwitching(true);
      setSwitchError(null);

      try {
        await switchChainAsync({ chainId });

        // Check if a newer switch was requested while we were waiting
        if (versionRef.current !== version) return false;

        setIsSwitching(false);
        return true;
      } catch (err: any) {
        // Stale — a newer switch superseded this one
        if (versionRef.current !== version) return false;

        const code = err?.code ?? err?.cause?.code;

        // Chain not in wallet — try to add it
        if (code === 4902 || code === -32603) {
          try {
            const provider = (window as any).ethereum;
            if (!provider?.request) throw err;

            const rpcUrl = EVM_CHAIN_RPC[chainId];
            if (!rpcUrl) throw err;

            const config = getConfigByNetwork(`eip155:${chainId}`);
            const nativeCurrency = EVM_NATIVE_CURRENCY[chainId] || { name: "ETH", symbol: "ETH", decimals: 18 };

            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${chainId.toString(16)}`,
                  chainName: config?.name || getEvmChainName(chainId) || `Chain ${chainId}`,
                  rpcUrls: [rpcUrl],
                  nativeCurrency,
                  blockExplorerUrls: config?.explorer ? [config.explorer.replace("/tx/", "")] : undefined,
                },
              ],
            });

            // Retry switch after adding
            await switchChainAsync({ chainId });

            if (versionRef.current !== version) return false;
            setIsSwitching(false);
            return true;
          } catch {
            if (versionRef.current !== version) return false;
            const name = getEvmChainName(chainId) || `Chain ${chainId}`;
            setSwitchError(`Failed to add ${name} to wallet`);
            setIsSwitching(false);
            return false;
          }
        }

        // User rejected (4001) or other error
        if (code === 4001) {
          setSwitchError(null); // User intentionally rejected — not an error
        } else {
          const name = getEvmChainName(chainId) || `Chain ${chainId}`;
          setSwitchError(`Failed to switch to ${name}`);
        }
        setIsSwitching(false);
        return false;
      }
    },
    [chain?.id, isConnected, switchChainAsync]
  );

  return {
    walletChainId: chain?.id,
    walletChainName: chain?.name || getEvmChainName(chain?.id),
    isSwitching,
    switchError,
    ensureChain,
  };
}
