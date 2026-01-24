"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { useTonPayment } from "@/hooks/useTonPayment";
import { useSolanaPayment } from "@/hooks/useSolanaPayment";
import { useTronPayment } from "@/hooks/useTronPayment";
import { useStacksPayment } from "@/hooks/useStacksPayment";

const CHAIN_LABELS: Record<string, string> = {
  evm: "EVM",
  ton: "TON",
  tron: "TRON",
  solana: "Solana",
  stacks: "Stacks",
};

export function WalletButton() {
  const { activeFamily } = useChainContext();

  switch (activeFamily) {
    case "evm":
      return <EvmWalletButton />;
    case "ton":
      return <TonWalletButton />;
    case "solana":
      return <SolanaWalletButton />;
    case "tron":
      return <TronWalletButton />;
    case "stacks":
      return <StacksWalletButton />;
    default:
      return null;
  }
}

function DemoWalletBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
      <span className="h-2 w-2 rounded-full bg-[var(--color-warning)]" />
      <span className="font-mono text-xs text-white">Demo Wallet</span>
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
    </div>
  );
}

function ConnectedBadge({
  address,
  label,
  onDisconnect,
}: {
  address: string;
  label: string;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
        <span className="font-mono text-xs text-white">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <span className="text-xs text-[var(--color-muted)]">{label}</span>
      </div>
      <button
        onClick={onDisconnect}
        className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs text-[var(--color-muted)] hover:text-white transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}

function ConnectButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="btn-primary rounded-lg px-4 py-1.5 text-sm"
    >
      Connect {label}
    </button>
  );
}

// --- Chain-specific wallet buttons ---

function EvmWalletButton() {
  const { isDemo } = useDemoContext();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isDemo) return <DemoWalletBadge label="EVM" />;

  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label={chain?.name || "EVM"}
        onDisconnect={() => disconnect()}
      />
    );
  }

  return (
    <ConnectButton
      label="Wallet"
      onClick={() => {
        const injected = connectors.find((c) => c.id === "injected");
        if (injected) connect({ connector: injected });
      }}
    />
  );
}

function TonWalletButton() {
  const { isDemo } = useDemoContext();
  const { address, isConnected, connect, disconnect } = useTonPayment();

  if (isDemo) return <DemoWalletBadge label="TON" />;
  if (isConnected && address) {
    return <ConnectedBadge address={address} label="TON" onDisconnect={disconnect} />;
  }
  return <ConnectButton label="TON" onClick={connect} />;
}

function SolanaWalletButton() {
  const { isDemo } = useDemoContext();
  const { address, isConnected, connect, disconnect } = useSolanaPayment();

  if (isDemo) return <DemoWalletBadge label="Solana" />;
  if (isConnected && address) {
    return <ConnectedBadge address={address} label="Solana" onDisconnect={disconnect} />;
  }
  return <ConnectButton label="Solana" onClick={connect} />;
}

function TronWalletButton() {
  const { isDemo } = useDemoContext();
  const { address, isConnected, isInstalled, connect, disconnect } = useTronPayment();

  if (isDemo) return <DemoWalletBadge label="TRON" />;
  if (isConnected && address) {
    return <ConnectedBadge address={address} label="TRON" onDisconnect={disconnect} />;
  }
  return (
    <ConnectButton
      label={isInstalled ? "TronLink" : "TRON"}
      onClick={connect}
    />
  );
}

function StacksWalletButton() {
  const { isDemo } = useDemoContext();
  const { address, isConnected, connect, disconnect } = useStacksPayment();

  if (isDemo) return <DemoWalletBadge label="Stacks" />;
  if (isConnected && address) {
    return <ConnectedBadge address={address} label="Stacks" onDisconnect={disconnect} />;
  }
  return <ConnectButton label="Stacks" onClick={connect} />;
}
