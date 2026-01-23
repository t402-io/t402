"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
          <span className="font-mono text-xs text-white">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          {chain && (
            <span className="text-xs text-[var(--color-muted)]">
              {chain.name}
            </span>
          )}
        </div>
        <button
          onClick={() => disconnect()}
          className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs text-[var(--color-muted)] hover:text-white transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        const injected = connectors.find((c) => c.id === "injected");
        if (injected) connect({ connector: injected });
      }}
      className="btn-primary rounded-lg px-4 py-1.5 text-sm"
    >
      Connect Wallet
    </button>
  );
}
