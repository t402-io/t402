"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { useTonPayment } from "@/hooks/useTonPayment";
import { useSolanaPayment } from "@/hooks/useSolanaPayment";
import { useTronPayment } from "@/hooks/useTronPayment";
import { useStacksPayment } from "@/hooks/useStacksPayment";

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

function InstallButton({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg border border-[var(--color-border)] px-4 py-1.5 text-xs text-[var(--color-muted)] hover:text-white hover:border-[var(--color-brand)] transition-colors"
    >
      Install {label}
    </a>
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

  // Try connectors in order: injected (MetaMask), walletConnect, coinbaseWallet
  const handleConnect = () => {
    const injected = connectors.find((c) => c.id === "injected");
    const wc = connectors.find((c) => c.id === "walletConnect");
    const cb = connectors.find((c) => c.id === "coinbaseWalletSDK");

    if (injected) {
      connect({ connector: injected });
    } else if (wc) {
      connect({ connector: wc });
    } else if (cb) {
      connect({ connector: cb });
    } else {
      // No connectors available — open MetaMask install page
      window.open("https://metamask.io/download/", "_blank");
    }
  };

  return <ConnectButton label="Wallet" onClick={handleConnect} />;
}

function TonWalletButton() {
  const { isDemo } = useDemoContext();
  const { address, isConnected, connect, disconnect } = useTonPayment();

  if (isDemo) return <DemoWalletBadge label="TON" />;
  if (isConnected && address) {
    return <ConnectedBadge address={address} label="TON" onDisconnect={disconnect} />;
  }
  // TonConnect always works — shows QR code / deep link modal
  return <ConnectButton label="TON" onClick={connect} />;
}

function SolanaWalletButton() {
  const { isDemo } = useDemoContext();
  const { address, isConnected, hasWallet, connect, disconnect } = useSolanaPayment();

  if (isDemo) return <DemoWalletBadge label="Solana" />;
  if (isConnected && address) {
    return <ConnectedBadge address={address} label="Solana" onDisconnect={disconnect} />;
  }
  if (!hasWallet) {
    return <InstallButton label="Phantom" url="https://phantom.app/" />;
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
  if (!isInstalled) {
    return <InstallButton label="TronLink" url="https://www.tronlink.org/" />;
  }
  return <ConnectButton label="TronLink" onClick={connect} />;
}

function StacksWalletButton() {
  const { isDemo } = useDemoContext();
  const { address, isConnected, connect, disconnect } = useStacksPayment();

  if (isDemo) return <DemoWalletBadge label="Stacks" />;
  if (isConnected && address) {
    return <ConnectedBadge address={address} label="Stacks" onDisconnect={disconnect} />;
  }
  // Stacks Connect works via popup — always available
  return <ConnectButton label="Stacks" onClick={connect} />;
}
