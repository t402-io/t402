"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { CosmosWalletContext } from "@/hooks/useCosmosPayment";

// Lazy-load CosmJS + Keplr integration into a separate chunk.
const CosmosWalletContextProvider = dynamic(() => import("./CosmosWalletContext"), {
  ssr: false,
});

// Fallback context values before the real provider loads
const FALLBACK_COSMOS_STATE = {
  address: null,
  isConnected: false,
  isLoading: true,
  connect: async () => {},
  disconnect: async () => {},
  sendTokens: async () => "",
};

export function CosmosProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before the real Cosmos provider loads, provide clean fallback context
  if (!mounted) {
    return (
      <CosmosWalletContext.Provider value={FALLBACK_COSMOS_STATE}>
        {children}
      </CosmosWalletContext.Provider>
    );
  }

  return <CosmosWalletContextProvider>{children}</CosmosWalletContextProvider>;
}
