"use client";

import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
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
import { useCosmosPayment } from "@/hooks/useCosmosPayment";
import { useStellarPayment } from "@/hooks/useStellarPayment";

// Loading placeholder shown during SSR and initial hydration
function WalletButtonSkeleton() {
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-1.5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--color-text-tertiary)" }} />
      <span className="font-mono text-xs" style={{ color: "var(--color-text-tertiary)" }}>...</span>
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
    case "cosmos":
      return <CosmosWalletButton />;
    case "stellar":
      return <StellarWalletButton />;
    default:
      return null;
  }
}

function DemoWalletBadge({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2 py-1"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-warning)" }} />
      <span className="font-mono text-[10px] sm:text-xs text-white">
        <span className="sm:hidden">Demo</span>
        <span className="hidden sm:inline">Demo Wallet</span>
      </span>
      <span className="hidden sm:inline text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>{label}</span>
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
      <div
        className="flex items-center gap-1 sm:gap-1.5 rounded-xl px-1.5 sm:px-2.5 py-1 sm:py-1.5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0 rounded-full" style={{ background: "var(--color-success)" }} />
        <span className="font-mono text-[9px] sm:text-xs text-white">
          <span className="sm:hidden">{address.slice(0, 4)}..{address.slice(-2)}</span>
          <span className="hidden sm:inline">{address.slice(0, 4)}...{address.slice(-3)}</span>
        </span>
        <span className="hidden sm:inline text-xs" style={{ color: "var(--color-text-tertiary)" }}>{label}</span>
      </div>
      <button
        onClick={onDisconnect}
        className="rounded-xl px-1.5 sm:px-2 py-1 sm:py-1.5 text-[9px] sm:text-xs hover:text-white transition-colors"
        style={{ border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
        aria-label={`Disconnect ${label} wallet`}
      >
        <span className="hidden sm:inline">Disconnect</span>
        <span className="sm:hidden">&times;</span>
      </button>
    </div>
  );
}

function ConnectButton({ label, onClick, loading }: { label: string; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="btn-primary rounded-xl px-4 py-2.5 text-sm min-h-[40px]"
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
      className="rounded-xl px-4 py-2.5 text-xs hover:text-white transition-colors min-h-[40px] flex items-center"
      style={{ border: "1px solid var(--color-border-hover)", color: "var(--color-muted)" }}
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
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();

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

  return <ConnectButton label="Wallet" onClick={() => open()} />;
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

function CosmosWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useCosmosPayment();

  if (isDemo) return <DemoWalletBadge label="Cosmos" />;
  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label="Cosmos"
        onDisconnect={() => {
          disconnect();
          show("info", "Cosmos wallet disconnected");
        }}
      />
    );
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      show("error", `Keplr connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  if (!hasWallet) {
    return <InstallButton label="Keplr" url="https://www.keplr.app/" />;
  }

  return <ConnectButton label="Keplr" onClick={handleConnect} />;
}

function StellarWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useStellarPayment();

  if (isDemo) return <DemoWalletBadge label="Stellar" />;
  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label="Stellar"
        onDisconnect={() => {
          disconnect();
          show("info", "Stellar wallet disconnected");
        }}
      />
    );
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      show("error", `Freighter connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  if (!hasWallet) {
    return <InstallButton label="Freighter" url="https://www.freighter.app/" />;
  }

  return <ConnectButton label="Stellar" onClick={handleConnect} />;
}
