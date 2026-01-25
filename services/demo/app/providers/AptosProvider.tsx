"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AptosWalletContext } from "@/hooks/useAptosPayment";

// Lazy-load Aptos SDK (~150KB) into a separate chunk.
const AptosWalletContextProvider = dynamic(() => import("./AptosWalletContext"), {
  ssr: false,
});

// Fallback context values before the real provider loads
const FALLBACK_APTOS_STATE = {
  address: null,
  isConnected: false,
  isLoading: true,
  connect: async () => {},
  disconnect: async () => {},
  transferFungibleAsset: async () => "",
};

export function AptosProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before the real Aptos provider loads, provide clean fallback context
  if (!mounted) {
    return (
      <AptosWalletContext.Provider value={FALLBACK_APTOS_STATE}>
        {children}
      </AptosWalletContext.Provider>
    );
  }

  return <AptosWalletContextProvider>{children}</AptosWalletContextProvider>;
}
