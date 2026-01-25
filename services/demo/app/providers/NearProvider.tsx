"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { NearWalletContext } from "@/hooks/useNearPayment";

// Lazy-load NEAR Wallet Selector (~200KB) into a separate chunk.
const NearWalletContextProvider = dynamic(() => import("./NearWalletContext"), {
  ssr: false,
});

// Fallback context values before the real provider loads
const FALLBACK_NEAR_STATE = {
  accountId: null,
  isConnected: false,
  isLoading: true,
  connect: async () => {},
  disconnect: async () => {},
  signAndSendTransaction: async () => "",
};

export function NearProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before the real NEAR provider loads, provide clean fallback context
  if (!mounted) {
    return (
      <NearWalletContext.Provider value={FALLBACK_NEAR_STATE}>
        {children}
      </NearWalletContext.Provider>
    );
  }

  return <NearWalletContextProvider>{children}</NearWalletContextProvider>;
}
