"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";

const CHAIN_LABELS: Record<string, string> = {
  evm: "EVM",
  ton: "TON",
  tron: "TRON",
  solana: "Solana",
  stacks: "Stacks",
};

export function WalletButton() {
  const { activeFamily } = useChainContext();
  const { isDemo } = useDemoContext();

  if (activeFamily === "evm") {
    return <EvmWalletButton />;
  }

  // Non-EVM chains: show demo wallet or "coming soon"
  if (isDemo) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-[var(--color-warning)]" />
        <span className="font-mono text-xs text-white">Demo Wallet</span>
        <span className="text-xs text-[var(--color-muted)]">
          {CHAIN_LABELS[activeFamily]}
        </span>
      </div>
    );
  }

  return (
    <button
      disabled
      className="rounded-lg border border-[var(--color-border)] px-4 py-1.5 text-xs text-[var(--color-muted)] cursor-not-allowed"
      title={`${CHAIN_LABELS[activeFamily]} wallet integration coming soon`}
    >
      {CHAIN_LABELS[activeFamily]} Wallet (Soon)
    </button>
  );
}

function EvmWalletButton() {
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
