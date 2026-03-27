"use client";

import { useReducer, useCallback, useRef } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { EVM_CHAIN_RPC, EVM_NATIVE_CURRENCY, getEvmChainName } from "@/lib/evm-chains";
import { getConfigByNetwork } from "@/lib/chain-registry";

// ---------------------------------------------------------------------------
// Chain switch FSM states
// ---------------------------------------------------------------------------

export type ChainSwitchStatus =
  | "idle"
  | "switching"
  | "adding-chain"
  | "confirming"
  | "ready"
  | "failed"
  | "cancelled";

interface ChainSwitchState {
  status: ChainSwitchStatus;
  targetChainId: number | null;
  error: string | null;
}

type ChainSwitchAction =
  | { type: "START_SWITCH"; chainId: number }
  | { type: "ADDING_CHAIN" }
  | { type: "CONFIRMING" }
  | { type: "READY" }
  | { type: "FAILED"; error: string }
  | { type: "CANCELLED" }
  | { type: "RESET" };

function chainSwitchReducer(state: ChainSwitchState, action: ChainSwitchAction): ChainSwitchState {
  switch (action.type) {
    case "START_SWITCH":
      return { status: "switching", targetChainId: action.chainId, error: null };
    case "ADDING_CHAIN":
      return { ...state, status: "adding-chain" };
    case "CONFIRMING":
      return { ...state, status: "confirming" };
    case "READY":
      return { status: "ready", targetChainId: null, error: null };
    case "FAILED":
      return { ...state, status: "failed", error: action.error };
    case "CANCELLED":
      return { status: "cancelled", targetChainId: null, error: null };
    case "RESET":
      return { status: "idle", targetChainId: null, error: null };
    default:
      return state;
  }
}

const INITIAL_STATE: ChainSwitchState = { status: "idle", targetChainId: null, error: null };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface EvmChainSyncResult {
  /** Wallet's current EVM chain ID */
  walletChainId: number | undefined;
  /** Wallet's current chain name */
  walletChainName: string | undefined;
  /** FSM state for chain switching */
  switchState: ChainSwitchState;
  /** True while any switch operation is in-flight */
  isSwitching: boolean;
  /** Last switch error message */
  switchError: string | null;
  /** Switch wallet to a specific EVM chain ID. Returns true on success. */
  ensureChain: (chainId: number) => Promise<boolean>;
  /** Reset the switch state to idle */
  resetSwitchState: () => void;
}

export function useEvmChainSync(): EvmChainSyncResult {
  const { chain, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [switchState, dispatch] = useReducer(chainSwitchReducer, INITIAL_STATE);

  // Version counter to cancel stale operations
  const versionRef = useRef(0);
  // Debounce timer for rapid successive switches
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ensureChain = useCallback(
    async (chainId: number): Promise<boolean> => {
      // Already on correct chain
      if (chain?.id === chainId) {
        dispatch({ type: "READY" });
        return true;
      }

      // Wallet not connected — can't switch
      if (!isConnected || !switchChainAsync) {
        dispatch({ type: "FAILED", error: "Wallet not connected" });
        return false;
      }

      // Cancel any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      // Increment version to cancel any in-flight switch
      const version = ++versionRef.current;
      dispatch({ type: "START_SWITCH", chainId });

      const isStale = () => versionRef.current !== version;
      const chainName = getEvmChainName(chainId) || `Chain ${chainId}`;

      try {
        await switchChainAsync({ chainId });

        if (isStale()) {
          dispatch({ type: "CANCELLED" });
          return false;
        }

        // Post-switch confirmation: verify wallet is on the right chain
        dispatch({ type: "CONFIRMING" });
        const confirmed = await confirmChainSwitch(chainId, 3000);

        if (isStale()) {
          dispatch({ type: "CANCELLED" });
          return false;
        }

        if (confirmed) {
          dispatch({ type: "READY" });
          return true;
        }

        // Wagmi says success but we can't confirm — trust it
        dispatch({ type: "READY" });
        return true;
      } catch (err: any) {
        if (isStale()) {
          dispatch({ type: "CANCELLED" });
          return false;
        }

        const code = err?.code ?? err?.cause?.code;

        // Chain not in wallet — try to add it
        if (code === 4902 || code === -32603) {
          dispatch({ type: "ADDING_CHAIN" });

          try {
            const provider = getWalletProvider();
            if (!provider) throw err;

            const rpcUrl = EVM_CHAIN_RPC[chainId];
            if (!rpcUrl) throw new Error(`No RPC URL for ${chainName}`);

            const config = getConfigByNetwork(`eip155:${chainId}`);
            const nativeCurrency = EVM_NATIVE_CURRENCY[chainId] || { name: "ETH", symbol: "ETH", decimals: 18 };

            await provider.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: `0x${chainId.toString(16)}`,
                chainName: config?.name || chainName,
                rpcUrls: [rpcUrl],
                nativeCurrency,
                blockExplorerUrls: config?.explorer ? [config.explorer.replace("/tx/", "")] : undefined,
              }],
            });

            if (isStale()) {
              dispatch({ type: "CANCELLED" });
              return false;
            }

            // OKX compatibility: small delay after adding chain before switching
            await new Promise((r) => setTimeout(r, 500));

            // Retry switch after adding
            await switchChainAsync({ chainId });

            if (isStale()) {
              dispatch({ type: "CANCELLED" });
              return false;
            }

            dispatch({ type: "CONFIRMING" });
            await confirmChainSwitch(chainId, 3000);

            if (isStale()) {
              dispatch({ type: "CANCELLED" });
              return false;
            }

            dispatch({ type: "READY" });
            return true;
          } catch {
            if (isStale()) {
              dispatch({ type: "CANCELLED" });
              return false;
            }
            dispatch({ type: "FAILED", error: `Failed to add ${chainName} to wallet` });
            return false;
          }
        }

        // User rejected (4001)
        if (code === 4001) {
          dispatch({ type: "FAILED", error: "Chain switch rejected" });
          return false;
        }

        // OKX: chain switch already pending
        if (code === -32002) {
          dispatch({ type: "FAILED", error: "A chain switch is already pending in your wallet" });
          return false;
        }

        // Generic error
        dispatch({ type: "FAILED", error: `Failed to switch to ${chainName}` });
        return false;
      }
    },
    [chain?.id, isConnected, switchChainAsync]
  );

  const resetSwitchState = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    walletChainId: chain?.id,
    walletChainName: chain?.name || getEvmChainName(chain?.id),
    switchState,
    isSwitching: switchState.status === "switching" || switchState.status === "adding-chain" || switchState.status === "confirming",
    switchError: switchState.error,
    ensureChain,
    resetSwitchState,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the wallet provider, handling multi-provider (MetaMask + OKX) cases */
function getWalletProvider(): any | null {
  if (typeof window === "undefined") return null;
  const ethereum = (window as any).ethereum;
  if (!ethereum?.request) return null;
  return ethereum;
}

/**
 * Poll eth_chainId after a switch to confirm the wallet actually switched.
 * Returns true if confirmed, false on timeout.
 */
async function confirmChainSwitch(expectedChainId: number, maxWait: number): Promise<boolean> {
  const provider = getWalletProvider();
  if (!provider) return true; // Can't confirm, trust Wagmi

  const start = Date.now();
  const expectedHex = `0x${expectedChainId.toString(16)}`;

  while (Date.now() - start < maxWait) {
    try {
      const currentChainId = await provider.request({ method: "eth_chainId" });
      if (currentChainId === expectedHex || parseInt(currentChainId, 16) === expectedChainId) {
        return true;
      }
    } catch {
      // Ignore polling errors
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return false; // Timeout — caller decides what to do
}
