"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { SolanaWalletCtx } from "@/hooks/useSolanaPayment";

// Lazy-load @solana/web3.js + wallet adapters (~400KB) into a separate chunk.
const SolanaWalletContext = dynamic(() => import("./SolanaWalletContext"), {
  ssr: false,
});

// Lazy-load the inner context bridge that reads SDK hooks into our custom context.
const SolanaWalletSafeContext = dynamic(() => import("./SolanaWalletSafeContext"), {
  ssr: false,
});

// Fallback context values before the real provider loads
const FALLBACK_SOLANA_STATE = {
  publicKey: null,
  connected: false,
  signTransaction: null,
  connection: null,
  hasWallet: false,
  connect: async () => {},
  disconnect: async () => {},
  wallets: [] as never[],
  select: () => {},
  wallet: null,
};

export function SolanaProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before the real Solana providers load, provide clean fallback context
  if (!mounted) {
    return (
      <SolanaWalletCtx.Provider value={FALLBACK_SOLANA_STATE}>
        {children}
      </SolanaWalletCtx.Provider>
    );
  }

  return (
    <SolanaWalletContext>
      <SolanaWalletSafeContext>
        {children}
      </SolanaWalletSafeContext>
    </SolanaWalletContext>
  );
}
