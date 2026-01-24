"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type ChainFamily, CHAIN_CONFIGS, type ChainConfig } from "@/lib/testnet-config";

interface ChainContextValue {
  activeFamily: ChainFamily;
  setActiveFamily: (family: ChainFamily) => void;
  activeConfig: ChainConfig;
  isConnected: boolean;
  address: string | null;
  setWalletState: (connected: boolean, address: string | null) => void;
}

const ChainContext = createContext<ChainContextValue>({
  activeFamily: "evm",
  setActiveFamily: () => {},
  activeConfig: CHAIN_CONFIGS.evm,
  isConnected: false,
  address: null,
  setWalletState: () => {},
});

export function useChainContext() {
  return useContext(ChainContext);
}

export function ChainProvider({ children }: { children: ReactNode }) {
  const [activeFamily, setActiveFamilyState] = useState<ChainFamily>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("t402-chain-family") as ChainFamily) || "evm";
    }
    return "evm";
  });

  const [walletState, setWalletStateInternal] = useState<{
    connected: boolean;
    address: string | null;
  }>({ connected: false, address: null });

  const setActiveFamily = useCallback((family: ChainFamily) => {
    setActiveFamilyState(family);
    if (typeof window !== "undefined") {
      localStorage.setItem("t402-chain-family", family);
    }
  }, []);

  const setWalletState = useCallback((connected: boolean, address: string | null) => {
    setWalletStateInternal({ connected, address });
  }, []);

  const value: ChainContextValue = {
    activeFamily,
    setActiveFamily,
    activeConfig: CHAIN_CONFIGS[activeFamily],
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
