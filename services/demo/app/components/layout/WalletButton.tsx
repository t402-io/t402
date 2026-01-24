"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { useToast } from "@/providers/ToastProvider";
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

function ConnectButton({ label, onClick, loading }: { label: string; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="btn-primary rounded-lg px-4 py-1.5 text-sm"
    >
      {loading ? "Connecting..." : `Connect ${label}`}
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
  const { show } = useToast();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isDemo) return <DemoWalletBadge label="EVM" />;

  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label={chain?.name || "EVM"}
        onDisconnect={() => {
          disconnect();
          show("info", "Wallet disconnected");
        }}
      />
    );
  }

  const hasInjectedProvider = typeof window !== "undefined" && !!window.ethereum;

  const handleConnect = () => {
    if (hasInjectedProvider) {
      const injected = connectors.find((c) => c.id === "injected");
      if (injected) {
        connect(
          { connector: injected },
          {
            onSuccess: () => show("success", "EVM wallet connected"),
            onError: (err) => show("error", `Connection failed: ${err.message}`),
          }
        );
        return;
      }
    }
    const wc = connectors.find((c) => c.id === "walletConnect");
    if (wc) {
      connect(
        { connector: wc },
        {
          onSuccess: () => show("success", "EVM wallet connected via WalletConnect"),
          onError: (err) => show("error", `WalletConnect failed: ${err.message}`),
        }
      );
      return;
    }
    show("warning", "No EVM wallet detected. Opening MetaMask install page.");
    window.open("https://metamask.io/download/", "_blank");
  };

  if (!hasInjectedProvider && !connectors.some((c) => c.id === "walletConnect")) {
    return <InstallButton label="MetaMask" url="https://metamask.io/download/" />;
  }

  return <ConnectButton label="Wallet" onClick={handleConnect} loading={isPending} />;
}

function TonWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, connect, disconnect } = useTonPayment();

  if (isDemo) return <DemoWalletBadge label="TON" />;
  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label="TON"
        onDisconnect={() => {
          disconnect();
          show("info", "TON wallet disconnected");
        }}
      />
    );
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      show("error", `TON connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return <ConnectButton label="TON" onClick={handleConnect} />;
}

function SolanaWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useSolanaPayment();

  if (isDemo) return <DemoWalletBadge label="Solana" />;
  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label="Solana"
        onDisconnect={() => {
          disconnect();
          show("info", "Solana wallet disconnected");
        }}
      />
    );
  }
  if (!hasWallet) {
    return <InstallButton label="Phantom" url="https://phantom.app/" />;
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      show("error", `Solana connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return <ConnectButton label="Solana" onClick={handleConnect} />;
}

function TronWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, isInstalled, connect, disconnect } = useTronPayment();

  if (isDemo) return <DemoWalletBadge label="TRON" />;
  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label="TRON"
        onDisconnect={() => {
          disconnect();
          show("info", "TRON wallet disconnected");
        }}
      />
    );
  }
  if (!isInstalled) {
    return <InstallButton label="TronLink" url="https://www.tronlink.org/" />;
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      show("error", `TronLink connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return <ConnectButton label="TronLink" onClick={handleConnect} />;
}

function StacksWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, connect, disconnect } = useStacksPayment();

  if (isDemo) return <DemoWalletBadge label="Stacks" />;
  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label="Stacks"
        onDisconnect={() => {
          disconnect();
          show("info", "Stacks wallet disconnected");
        }}
      />
    );
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      show("error", `Stacks connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return <ConnectButton label="Stacks" onClick={handleConnect} />;
}
