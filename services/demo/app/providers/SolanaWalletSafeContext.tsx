"use client";

import { type ReactNode } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { SolanaWalletCtx } from "@/hooks/useSolanaPayment";

/**
 * Inner component that reads from @solana/wallet-adapter-react hooks
 * and provides values via our custom SolanaWalletCtx.
 * Loaded lazily by SolanaProvider.
 */
export default function SolanaWalletSafeContext({ children }: { children: ReactNode }) {
  const { publicKey, signTransaction, connected, connect, disconnect, wallets, select, wallet } = useWallet();
  const { connection } = useConnection();

  const hasWallet = wallets.some((w) => w.readyState === "Installed");

  return (
    <SolanaWalletCtx.Provider
      value={{
        publicKey: publicKey?.toBase58() || null,
        connected,
        signTransaction: signTransaction || null,
        connection,
        hasWallet,
        connect: async () => { if (connect) await connect(); },
        disconnect: async () => { if (disconnect) await disconnect(); },
        wallets,
        select,
        wallet,
      }}
    >
      {children}
    </SolanaWalletCtx.Provider>
  );
}
