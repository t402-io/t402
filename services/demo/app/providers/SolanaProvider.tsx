"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { WalletContext } from "@solana/wallet-adapter-react";
import type { WalletContextState } from "@solana/wallet-adapter-react";

// Lazy-load @solana/web3.js + wallet adapters (~400KB) into a separate chunk.
const SolanaWalletContext = dynamic(() => import("./SolanaWalletContext"), {
  ssr: false,
});

// Clean fallback values for useWallet() — no console.error spam from getters.
const FALLBACK_WALLET_STATE: WalletContextState = {
  autoConnect: false,
  wallets: [],
  wallet: null,
  publicKey: null,
  connecting: false,
  connected: false,
  disconnecting: false,
  select: () => {},
  connect: () => Promise.reject(new Error("Wallet provider not loaded")),
  disconnect: () => Promise.reject(new Error("Wallet provider not loaded")),
  sendTransaction: () => Promise.reject(new Error("Wallet provider not loaded")),
  signTransaction: undefined,
  signAllTransactions: undefined,
  signMessage: undefined,
  signIn: undefined,
};

export function SolanaProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before the real Solana providers load, provide clean fallback context
  // so useWallet() calls don't spam console.error from default getters.
  if (!mounted) {
    return (
      <WalletContext.Provider value={FALLBACK_WALLET_STATE}>
        {children}
      </WalletContext.Provider>
    );
  }

  return <SolanaWalletContext>{children}</SolanaWalletContext>;
}
