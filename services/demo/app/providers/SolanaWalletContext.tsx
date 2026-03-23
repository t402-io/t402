"use client";

import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

/**
 * The actual Solana wallet providers. This is loaded lazily by SolanaProvider
 * to keep ~400KB of @solana/web3.js out of the initial bundle.
 */
export default function SolanaWalletContext({
  children,
  cluster = "devnet",
}: {
  children: ReactNode;
  cluster?: "devnet" | "mainnet-beta";
}) {
  const endpoint = useMemo(() => clusterApiUrl(cluster), [cluster]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
