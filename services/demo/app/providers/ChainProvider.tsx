"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { type ChainFamily, CHAIN_CONFIGS, type ChainConfig } from "@/lib/testnet-config";
import { getDefaultConfigForFamily, getMainnetConfigsForFamily, getConfigByNetwork, familyFromNetwork, MAINNET_CONFIGS } from "@/lib/chain-registry";
import { useDemoContext } from "./DemoProvider";

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
});

export function useChainContext() {
  return useContext(ChainContext);
}

const VALID_FAMILIES: ChainFamily[] = ["evm", "ton", "tron", "solana", "stacks", "near", "aptos", "tezos", "polkadot", "cosmos"];

export function ChainProvider({ children }: { children: ReactNode }) {
  const [activeFamily, setActiveFamilyState] = useState<ChainFamily>("evm");
  const [activeNetwork, setActiveNetworkState] = useState<string | null>(null);
  const { testnet } = useDemoContext();

  // Sync from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem("t402-chain-family") as ChainFamily | null;
    if (stored && VALID_FAMILIES.includes(stored)) {
      setActiveFamilyState(stored);
    }
    const storedNet = localStorage.getItem("t402-chain-network");
    if (storedNet) {
      setActiveNetworkState(storedNet);
    }
  }, []);

  const [walletState, setWalletStateInternal] = useState<{
    connected: boolean;
    address: string | null;
  }>({ connected: false, address: null });

  const setActiveFamily = useCallback((family: ChainFamily) => {
    setActiveFamilyState(family);
    setActiveNetworkState(null); // Reset network when switching family
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

  // Resolve activeConfig based on mode
  let activeConfig: ChainConfig;
  if (testnet) {
    activeConfig = CHAIN_CONFIGS[activeFamily];
  } else if (activeNetwork && activeNetwork in MAINNET_CONFIGS) {
    activeConfig = MAINNET_CONFIGS[activeNetwork];
  } else {
    activeConfig = getDefaultConfigForFamily(activeFamily, false);
  }

  const value: ChainContextValue = {
    activeFamily,
    setActiveFamily,
    activeNetwork,
    setActiveNetwork,
    activeConfig,
    isConnected: walletState.connected,
    address: walletState.address,
    setWalletState,
  };

  return (
    <ChainContext.Provider value={value}>
      {children}
    </ChainContext.Provider>
  );
}
