"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { useToast } from "@/providers/ToastProvider";
import { useWalletReady } from "@/providers/ClientProviders";
import { useTonPayment } from "@/hooks/useTonPayment";
import { useSolanaPayment } from "@/hooks/useSolanaPayment";
import { useTronPayment } from "@/hooks/useTronPayment";
import { useStacksPayment } from "@/hooks/useStacksPayment";
import { useNearPayment } from "@/hooks/useNearPayment";
import { useAptosPayment } from "@/hooks/useAptosPayment";
import { useTezosPayment } from "@/hooks/useTezosPayment";
import { usePolkadotPayment } from "@/hooks/usePolkadotPayment";

// Loading placeholder shown during SSR and initial hydration
function WalletButtonSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
      <span className="h-2 w-2 rounded-full bg-[var(--color-muted)] animate-pulse" />
      <span className="font-mono text-xs text-[var(--color-muted)]">...</span>
    </div>
  );
}

export function WalletButton() {
  const walletReady = useWalletReady();
  const { activeFamily } = useChainContext();

  // During SSR and before wallet providers are ready, show skeleton
  if (!walletReady) {
    return <WalletButtonSkeleton />;
  }

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
    case "near":
      return <NearWalletButton />;
    case "aptos":
      return <AptosWalletButton />;
    case "tezos":
      return <TezosWalletButton />;
    case "polkadot":
      return <PolkadotWalletButton />;
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
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 sm:px-3 py-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-success)]" />
        <span className="font-mono text-[10px] sm:text-xs text-white">
          {address.slice(0, 4)}...{address.slice(-3)}
        </span>
        <span className="hidden sm:inline text-xs text-[var(--color-muted)]">{label}</span>
      </div>
      <button
        onClick={onDisconnect}
        className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[10px] sm:text-xs text-[var(--color-muted)] hover:text-white transition-colors"
        aria-label={`Disconnect ${label} wallet`}
      >
        <span className="hidden sm:inline">Disconnect</span>
        <span className="sm:hidden">×</span>
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

function NearWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useNearPayment();

  if (isDemo) return <DemoWalletBadge label="NEAR" />;
  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label="NEAR"
        onDisconnect={() => {
          disconnect();
          show("info", "NEAR wallet disconnected");
        }}
      />
    );
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      show("error", `NEAR connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  if (!hasWallet) {
    return <InstallButton label="NEAR Wallet" url="https://wallet.near.org/" />;
  }

  return <ConnectButton label="NEAR" onClick={handleConnect} />;
}

function AptosWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useAptosPayment();

  if (isDemo) return <DemoWalletBadge label="Aptos" />;
  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label="Aptos"
        onDisconnect={() => {
          disconnect();
          show("info", "Aptos wallet disconnected");
        }}
      />
    );
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      show("error", `Aptos connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  if (!hasWallet) {
    return <InstallButton label="Petra" url="https://petra.app/" />;
  }

  return <ConnectButton label="Aptos" onClick={handleConnect} />;
}

function TezosWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useTezosPayment();

  if (isDemo) return <DemoWalletBadge label="Tezos" />;
  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label="Tezos"
        onDisconnect={() => {
          disconnect();
          show("info", "Tezos wallet disconnected");
        }}
      />
    );
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      show("error", `Tezos connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  if (!hasWallet) {
    return <InstallButton label="Temple" url="https://templewallet.com/" />;
  }

  return <ConnectButton label="Tezos" onClick={handleConnect} />;
}

function PolkadotWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = usePolkadotPayment();

  if (isDemo) return <DemoWalletBadge label="Polkadot" />;
  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label="Polkadot"
        onDisconnect={() => {
          disconnect();
          show("info", "Polkadot wallet disconnected");
        }}
      />
    );
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      show("error", `Polkadot connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  if (!hasWallet) {
    return <InstallButton label="Polkadot.js" url="https://polkadot.js.org/extension/" />;
  }

  return <ConnectButton label="Polkadot" onClick={handleConnect} />;
}
