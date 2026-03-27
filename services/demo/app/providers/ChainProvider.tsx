"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { type ChainFamily, CHAIN_CONFIGS, type ChainConfig } from "@/lib/testnet-config";
import { getDefaultConfigForFamily, getMainnetConfigsForFamily, getConfigByNetwork, familyFromNetwork, MAINNET_CONFIGS, TESTNET_CONFIGS } from "@/lib/chain-registry";
import { chainIdFromCaip2 } from "@/lib/evm-chains";
import { useDemoContext } from "./DemoProvider";

// ---------------------------------------------------------------------------
// EVM wallet state (pushed in by EvmChainSyncBridge)
// ---------------------------------------------------------------------------

export interface EvmWalletSyncState {
  walletChainId: number | undefined;
  walletChainName: string | undefined;
  isSwitching: boolean;
  switchError: string | null;
  ensureChain: (chainId: number) => Promise<boolean>;
}

const DEFAULT_EVM_SYNC: EvmWalletSyncState = {
  walletChainId: undefined,
  walletChainName: undefined,
  isSwitching: false,
  switchError: null,
  ensureChain: async () => false,
};

// ---------------------------------------------------------------------------
// Context interface
// ---------------------------------------------------------------------------

interface ChainContextValue {
  activeFamily: ChainFamily;
  setActiveFamily: (family: ChainFamily) => void;
  /** Specific CAIP-2 network (for mainnet per-chain EVM selection) */
  activeNetwork: string | null;
  setActiveNetwork: (network: string) => void;
  activeConfig: ChainConfig;
  isConnected: boolean;
  address: string | null;
  setWalletState: (connected: boolean, address: string | null) => void;

  // EVM wallet chain sync (populated by EvmChainSyncBridge)
  walletChainId: number | undefined;
  walletChainName: string | undefined;
  isSwitchingChain: boolean;
  chainSwitchError: string | null;
  /** True when wallet chain matches activeNetwork for EVM, or always true for non-EVM */
  isChainMatched: boolean;
  /** Switch wallet to a specific EVM chain. Returns true on success. */
  ensureEvmChain: (chainId: number) => Promise<boolean>;
  /** Internal: used by EvmChainSyncBridge to push wallet state */
  setEvmWalletState: (state: EvmWalletSyncState) => void;

  // Payment lock — prevents chain switching during active payment
  isPaymentInProgress: boolean;
  setPaymentInProgress: (inProgress: boolean) => void;
}

const ChainContext = createContext<ChainContextValue>({
  activeFamily: "evm",
  setActiveFamily: () => {},
  activeNetwork: null,
  setActiveNetwork: () => {},
  activeConfig: CHAIN_CONFIGS.evm,
  isConnected: false,
  address: null,
  setWalletState: () => {},
  walletChainId: undefined,
  walletChainName: undefined,
  isSwitchingChain: false,
  chainSwitchError: null,
  isChainMatched: true,
  ensureEvmChain: async () => false,
  setEvmWalletState: () => {},
  isPaymentInProgress: false,
  setPaymentInProgress: () => {},
});

export function useChainContext() {
  return useContext(ChainContext);
}

const VALID_FAMILIES = Object.keys(CHAIN_CONFIGS) as ChainFamily[];

/** Validate a CAIP-2 network ID exists in mainnet or testnet config */
function isValidNetwork(network: string): boolean {
  if (network in MAINNET_CONFIGS) return true;
  for (const family of VALID_FAMILIES) {
    if (TESTNET_CONFIGS[family].network === network) return true;
  }
  return false;
}

export function ChainProvider({ children }: { children: ReactNode }) {
  const [activeFamily, setActiveFamilyState] = useState<ChainFamily>("evm");
  const [activeNetwork, setActiveNetworkState] = useState<string | null>(null);
  const [isPaymentInProgress, setPaymentInProgress] = useState(false);
  const { testnet, isDemo } = useDemoContext();

  // Sync from localStorage after hydration — with validation
  useEffect(() => {
    const stored = localStorage.getItem("t402-chain-family") as ChainFamily | null;
    if (stored && VALID_FAMILIES.includes(stored)) {
      setActiveFamilyState(stored);
    }
    const storedNet = localStorage.getItem("t402-chain-network");
    if (storedNet && isValidNetwork(storedNet)) {
      setActiveNetworkState(storedNet);
    }
    // Invalid stored network silently ignored — falls back to default
  }, []);

  const [walletState, setWalletStateInternal] = useState<{
    connected: boolean;
    address: string | null;
  }>({ connected: false, address: null });

  // EVM wallet sync state (pushed by EvmChainSyncBridge)
  const [evmSync, setEvmSync] = useState<EvmWalletSyncState>(DEFAULT_EVM_SYNC);

  const setActiveFamily = useCallback((family: ChainFamily) => {
    setActiveFamilyState(family);
    setActiveNetworkState(null);
    if (typeof window !== "undefined") {
      localStorage.setItem("t402-chain-family", family);
      localStorage.removeItem("t402-chain-network");
    }
  }, []);

  const setActiveNetwork = useCallback((network: string) => {
    const family = familyFromNetwork(network);
    setActiveFamilyState(family);
    setActiveNetworkState(network);
    if (typeof window !== "undefined") {
      localStorage.setItem("t402-chain-family", family);
      localStorage.setItem("t402-chain-network", network);
    }
  }, []);

  const setWalletState = useCallback((connected: boolean, address: string | null) => {
    setWalletStateInternal({ connected, address });
  }, []);

  const setEvmWalletState = useCallback((state: EvmWalletSyncState) => {
    setEvmSync(state);
  }, []);

  // Resolve activeConfig based on mode
  const activeConfig = useMemo<ChainConfig>(() => {
    if (testnet) {
      return CHAIN_CONFIGS[activeFamily];
    } else if (activeNetwork && activeNetwork in MAINNET_CONFIGS) {
      return MAINNET_CONFIGS[activeNetwork];
    } else {
      return getDefaultConfigForFamily(activeFamily, false);
    }
  }, [testnet, activeFamily, activeNetwork]);

  // Determine if wallet chain matches the selected network
  // FIXED: Returns false when wallet connected but chain unknown (not true)
  const isChainMatched = useMemo(() => {
    // Non-EVM families: no chain switching concept — always matched
    if (activeFamily !== "evm") return true;
    // Demo mode: always matched (no real wallet)
    if (isDemo) return true;
    // No specific network selected: can't validate, treat as unmatched if wallet is connected
    if (!activeNetwork) return !walletState.connected;
    // Wallet not connected: can't compare — report unmatched to prevent accidental payments
    if (!evmSync.walletChainId) return !walletState.connected;
    // Currently switching: report unmatched until switch completes
    if (evmSync.isSwitching) return false;
    // Compare wallet chain with expected
    const expectedChainId = chainIdFromCaip2(activeNetwork);
    if (!expectedChainId) return false; // Invalid network — unmatched
    return evmSync.walletChainId === expectedChainId;
  }, [activeFamily, activeNetwork, evmSync.walletChainId, evmSync.isSwitching, walletState.connected, isDemo]);

  const value = useMemo<ChainContextValue>(() => ({
    activeFamily,
    setActiveFamily,
    activeNetwork,
    setActiveNetwork,
    activeConfig,
    isConnected: walletState.connected,
    address: walletState.address,
    setWalletState,
    walletChainId: evmSync.walletChainId,
    walletChainName: evmSync.walletChainName,
    isSwitchingChain: evmSync.isSwitching,
    chainSwitchError: evmSync.switchError,
    isChainMatched,
    ensureEvmChain: evmSync.ensureChain,
    setEvmWalletState,
    isPaymentInProgress,
    setPaymentInProgress,
  }), [activeFamily, setActiveFamily, activeNetwork, setActiveNetwork, activeConfig, walletState, setWalletState, evmSync, isChainMatched, setEvmWalletState, isPaymentInProgress]);

  return (
    <ChainContext.Provider value={value}>
      {children}
    </ChainContext.Provider>
  );
}
