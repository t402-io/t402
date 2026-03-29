"use client";

import { useEffect, useRef } from "react";
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
import { Wallet, Loader2 } from "lucide-react";

// Loading placeholder shown during SSR and initial hydration
function WalletButtonSkeleton() {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2 py-1"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--color-text-tertiary)" }} />
      <span className="font-mono text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>...</span>
    </div>
  );
}

export function WalletButton() {
  const walletReady = useWalletReady();
  const { activeFamily } = useChainContext();

  if (!walletReady) return <WalletButtonSkeleton />;

  switch (activeFamily) {
    case "evm": return <EvmWalletButton />;
    case "ton": return <TonWalletButton />;
    case "solana": return <SolanaWalletButton />;
    case "tron": return <TronWalletButton />;
    case "stacks": return <StacksWalletButton />;
    case "near": return <NearWalletButton />;
    case "aptos": return <AptosWalletButton />;
    case "tezos": return <TezosWalletButton />;
    case "polkadot": return <PolkadotWalletButton />;
    case "cosmos": return <CosmosWalletButton />;
    case "stellar": return <StellarWalletButton />;
    default: return null;
  }
}

// ─── Shared components ───

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

function ConnectedBadge({ address, label, onDisconnect }: { address: string; label: string; onDisconnect: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className="flex items-center gap-1 sm:gap-1.5 rounded-lg px-1.5 sm:px-2 py-1"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--color-success)" }} />
        <span className="font-mono text-[10px] sm:text-xs text-white">
          {address.slice(0, 4)}...{address.slice(-3)}
        </span>
        <span className="hidden sm:inline text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>{label}</span>
      </div>
      <button
        onClick={onDisconnect}
        className="rounded-lg px-1.5 py-1 text-[10px] hover:text-white transition-colors"
        style={{ border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
        aria-label={`Disconnect ${label} wallet`}
      >
        &times;
      </button>
    </div>
  );
}

function ConnectButton({ label, onClick, loading }: { label: string; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 btn-primary rounded-lg px-3 py-1.5 text-[11px] sm:text-sm min-h-[32px] sm:min-h-[36px]"
    >
      {loading ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          <span className="hidden sm:inline">Connecting...</span>
        </>
      ) : (
        <>
          <Wallet size={12} />
          <span className="hidden sm:inline">Connect {label}</span>
          <span className="sm:hidden">Connect</span>
        </>
      )}
    </button>
  );
}

function InstallButton({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg px-3 py-1.5 text-[10px] sm:text-xs hover:text-white transition-colors min-h-[32px] flex items-center"
      style={{ border: "1px solid var(--color-border-hover)", color: "var(--color-muted)" }}
    >
      Install {label}
    </a>
  );
}

// ─── EVM (AppKit) ───

function EvmWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, chain, isConnecting, isReconnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const prevConnected = useRef(false);

  // Show toast when connection state changes (returning from wallet app)
  useEffect(() => {
    if (isConnected && !prevConnected.current && address) {
      show("success", `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
    }
    prevConnected.current = isConnected;
  }, [isConnected, address, show]);

  if (isDemo) return <DemoWalletBadge label="EVM" />;

  // Show "Connecting..." while waiting for wallet app to respond
  if (isConnecting || isReconnecting) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-brand)" }}
      >
        <Loader2 size={12} className="animate-spin" style={{ color: "var(--color-brand)" }} />
        <span className="text-[10px] sm:text-xs font-medium" style={{ color: "var(--color-brand)" }}>
          <span className="sm:hidden">Connecting</span>
          <span className="hidden sm:inline">Connecting...</span>
        </span>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <ConnectedBadge
        address={address}
        label={chain?.name || "EVM"}
        onDisconnect={() => { disconnect(); show("info", "Wallet disconnected"); }}
      />
    );
  }

  return <ConnectButton label="Wallet" onClick={() => open()} />;
}

// ─── Non-EVM wallets (same pattern, simplified) ───

function TonWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, connect, disconnect } = useTonPayment();
  if (isDemo) return <DemoWalletBadge label="TON" />;
  if (isConnected && address) return <ConnectedBadge address={address} label="TON" onDisconnect={() => { disconnect(); show("info", "TON disconnected"); }} />;
  return <ConnectButton label="TON" onClick={async () => { try { await connect(); } catch (err) { show("error", `TON: ${err instanceof Error ? err.message : "Failed"}`); } }} />;
}

function SolanaWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useSolanaPayment();
  if (isDemo) return <DemoWalletBadge label="Solana" />;
  if (isConnected && address) return <ConnectedBadge address={address} label="Solana" onDisconnect={() => { disconnect(); show("info", "Solana disconnected"); }} />;
  if (!hasWallet) return <InstallButton label="Phantom" url="https://phantom.app/" />;
  return <ConnectButton label="Solana" onClick={async () => { try { await connect(); } catch (err) { show("error", `Solana: ${err instanceof Error ? err.message : "Failed"}`); } }} />;
}

function TronWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, isInstalled, connect, disconnect } = useTronPayment();
  if (isDemo) return <DemoWalletBadge label="TRON" />;
  if (isConnected && address) return <ConnectedBadge address={address} label="TRON" onDisconnect={() => { disconnect(); show("info", "TRON disconnected"); }} />;
  if (!isInstalled) return <InstallButton label="TronLink" url="https://www.tronlink.org/" />;
  return <ConnectButton label="TRON" onClick={async () => { try { await connect(); } catch (err) { show("error", `TRON: ${err instanceof Error ? err.message : "Failed"}`); } }} />;
}

function StacksWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, connect, disconnect } = useStacksPayment();
  if (isDemo) return <DemoWalletBadge label="Stacks" />;
  if (isConnected && address) return <ConnectedBadge address={address} label="Stacks" onDisconnect={() => { disconnect(); show("info", "Stacks disconnected"); }} />;
  return <ConnectButton label="Stacks" onClick={async () => { try { await connect(); } catch (err) { show("error", `Stacks: ${err instanceof Error ? err.message : "Failed"}`); } }} />;
}

function NearWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useNearPayment();
  if (isDemo) return <DemoWalletBadge label="NEAR" />;
  if (isConnected && address) return <ConnectedBadge address={address} label="NEAR" onDisconnect={() => { disconnect(); show("info", "NEAR disconnected"); }} />;
  if (!hasWallet) return <InstallButton label="NEAR Wallet" url="https://wallet.near.org/" />;
  return <ConnectButton label="NEAR" onClick={async () => { try { await connect(); } catch (err) { show("error", `NEAR: ${err instanceof Error ? err.message : "Failed"}`); } }} />;
}

function AptosWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useAptosPayment();
  if (isDemo) return <DemoWalletBadge label="Aptos" />;
  if (isConnected && address) return <ConnectedBadge address={address} label="Aptos" onDisconnect={() => { disconnect(); show("info", "Aptos disconnected"); }} />;
  if (!hasWallet) return <InstallButton label="Petra" url="https://petra.app/" />;
  return <ConnectButton label="Aptos" onClick={async () => { try { await connect(); } catch (err) { show("error", `Aptos: ${err instanceof Error ? err.message : "Failed"}`); } }} />;
}

function TezosWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useTezosPayment();
  if (isDemo) return <DemoWalletBadge label="Tezos" />;
  if (isConnected && address) return <ConnectedBadge address={address} label="Tezos" onDisconnect={() => { disconnect(); show("info", "Tezos disconnected"); }} />;
  if (!hasWallet) return <InstallButton label="Temple" url="https://templewallet.com/" />;
  return <ConnectButton label="Tezos" onClick={async () => { try { await connect(); } catch (err) { show("error", `Tezos: ${err instanceof Error ? err.message : "Failed"}`); } }} />;
}

function PolkadotWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = usePolkadotPayment();
  if (isDemo) return <DemoWalletBadge label="Polkadot" />;
  if (isConnected && address) return <ConnectedBadge address={address} label="Polkadot" onDisconnect={() => { disconnect(); show("info", "Polkadot disconnected"); }} />;
  if (!hasWallet) return <InstallButton label="Polkadot.js" url="https://polkadot.js.org/extension/" />;
  return <ConnectButton label="Polkadot" onClick={async () => { try { await connect(); } catch (err) { show("error", `Polkadot: ${err instanceof Error ? err.message : "Failed"}`); } }} />;
}

function CosmosWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useCosmosPayment();
  if (isDemo) return <DemoWalletBadge label="Cosmos" />;
  if (isConnected && address) return <ConnectedBadge address={address} label="Cosmos" onDisconnect={() => { disconnect(); show("info", "Cosmos disconnected"); }} />;
  if (!hasWallet) return <InstallButton label="Keplr" url="https://www.keplr.app/" />;
  return <ConnectButton label="Cosmos" onClick={async () => { try { await connect(); } catch (err) { show("error", `Keplr: ${err instanceof Error ? err.message : "Failed"}`); } }} />;
}

function StellarWalletButton() {
  const { isDemo } = useDemoContext();
  const { show } = useToast();
  const { address, isConnected, hasWallet, connect, disconnect } = useStellarPayment();
  if (isDemo) return <DemoWalletBadge label="Stellar" />;
  if (isConnected && address) return <ConnectedBadge address={address} label="Stellar" onDisconnect={() => { disconnect(); show("info", "Stellar disconnected"); }} />;
  if (!hasWallet) return <InstallButton label="Freighter" url="https://www.freighter.app/" />;
  return <ConnectButton label="Stellar" onClick={async () => { try { await connect(); } catch (err) { show("error", `Freighter: ${err instanceof Error ? err.message : "Failed"}`); } }} />;
}
