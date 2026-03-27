"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowRight,
  ArrowLeftRight,
  Clock,
  CheckCircle,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { ChainLogo } from "@/components/shared/ChainLogo";
import { Spinner } from "@/components/shared/Spinner";
import { SdkExamples } from "@/components/shared/SdkExamples";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import {
  PaymentStatus,
  parsePaymentResponse,
  type SettleInfo,
} from "@/components/shared/PaymentStatus";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { encodePaymentHeader } from "@/lib/t402-client";
import { useEvmChainSync } from "@/hooks/useEvmChainSync";
import { WalletChainIndicator } from "@/components/shared/WalletChainIndicator";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type BridgeState =
  | "idle"
  | "quoting"
  | "quoted"
  | "paying"
  | "bridging"
  | "tracking"
  | "delivered"
  | "failed";

type TrackingStage = "submitted" | "inflight" | "confirming" | "delivered";

type BridgeCategory = "major" | "l2" | "other";

interface BridgeChain {
  id: string;
  name: string;
  category: BridgeCategory;
}

interface Quote {
  available: boolean;
  simulated?: boolean;
  amountToSend: string;
  minAmountToReceive: string;
  nativeFeeFormatted: string;
  estimatedTime: number;
  estimatedTimeFormatted: string;
  fromChain: string;
  toChain: string;
  sufficientLiquidity?: boolean;
  bridgeLiquidityFormatted?: string;
  protocol: string;
  reason?: string;
}

interface TrackingData {
  guid: string;
  status: string;
  srcTxHash: string | null;
  dstTxHash: string | null;
  layerZeroScanUrl: string;
  estimatedTimeRemaining?: number;
  real?: boolean;
}

// CAIP-2 network IDs — T402 fee is paid on the FROM chain
const CHAIN_CAIP2: Record<string, string> = {
  ethereum: "eip155:1", arbitrum: "eip155:42161", optimism: "eip155:10",
  polygon: "eip155:137", ink: "eip155:57073", berachain: "eip155:80094",
  unichain: "eip155:130", mantle: "eip155:5000", sei: "eip155:1329",
  monad: "eip155:143", conflux: "eip155:1030", flare: "eip155:14",
  rootstock: "eip155:30", xlayer: "eip155:196", stable: "eip155:988",
  corn: "eip155:21000000", plasma: "eip155:9745", megaeth: "eip155:4326",
  hyperevm: "eip155:999", morph: "eip155:2818", hedera: "eip155:295",
  tempo: "eip155:698",
};

// EVM chainIds for wallet switching
const BRIDGE_CHAIN_IDS: Record<string, number> = {
  ethereum: 1, arbitrum: 42161, optimism: 10, polygon: 137,
  ink: 57073, berachain: 80094, unichain: 130, mantle: 5000,
  sei: 1329, monad: 143, conflux: 1030, flare: 14, rootstock: 30,
  xlayer: 196, stable: 988, corn: 21000000, plasma: 9745,
  megaeth: 4326, hyperevm: 999, morph: 2818, hedera: 295, tempo: 698,
};

const BRIDGE_CHAINS: BridgeChain[] = [
  // Major
  { id: "arbitrum", name: "Arbitrum", category: "major" },
  { id: "ethereum", name: "Ethereum", category: "major" },
  { id: "optimism", name: "Optimism", category: "major" },
  { id: "polygon", name: "Polygon", category: "major" },
  // L2/L3
  { id: "ink", name: "Ink", category: "l2" },
  { id: "berachain", name: "Berachain", category: "l2" },
  { id: "unichain", name: "Unichain", category: "l2" },
  { id: "mantle", name: "Mantle", category: "l2" },
  { id: "sei", name: "Sei", category: "l2" },
  { id: "monad", name: "Monad", category: "l2" },
  // Other
  { id: "conflux", name: "Conflux eSpace", category: "other" },
  { id: "flare", name: "Flare", category: "other" },
  { id: "rootstock", name: "Rootstock", category: "other" },
  { id: "xlayer", name: "XLayer", category: "other" },
  { id: "stable", name: "Stable", category: "other" },
  { id: "corn", name: "Corn", category: "other" },
  { id: "plasma", name: "Plasma", category: "other" },
  { id: "megaeth", name: "MegaETH", category: "other" },
  { id: "hyperevm", name: "HyperEVM", category: "other" },
  { id: "morph", name: "Morph", category: "other" },
  { id: "hedera", name: "Hedera", category: "other" },
  { id: "tempo", name: "Tempo", category: "other" },
];

const CHAIN_EXPLORERS: Record<string, string> = {
  ethereum: "https://etherscan.io/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  ink: "https://explorer.inkonchain.com/tx/",
  berachain: "https://berascan.com/tx/",
  unichain: "https://uniscan.xyz/tx/",
  mantle: "https://mantlescan.xyz/tx/",
  sei: "https://seitrace.com/tx/",
  monad: "https://explorer.monad.xyz/tx/",
  conflux: "https://evm.confluxscan.io/tx/",
  flare: "https://flarescan.com/tx/",
  rootstock: "https://explorer.rootstock.io/tx/",
  xlayer: "https://www.okx.com/web3/explorer/xlayer/tx/",
  stable: "https://explorer.stable.io/tx/",
  corn: "https://cornscan.io/tx/",
  plasma: "https://plasmascan.io/tx/",
  megaeth: "https://explorer.megaeth.com/tx/",
  hyperevm: "https://explorer.hyperliquid.xyz/tx/",
  morph: "https://explorer.morphl2.io/tx/",
  hedera: "https://hashscan.io/mainnet/transaction/",
  tempo: "https://explorer.tempo.xyz/tx/",
};

const TRACKING_STAGES: { key: TrackingStage; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "inflight", label: "Inflight" },
  { key: "confirming", label: "Confirming" },
  { key: "delivered", label: "Delivered" },
];

function stageIndex(stage: TrackingStage): number {
  return TRACKING_STAGES.findIndex((s) => s.key === stage);
}

function statusToStage(status: string): TrackingStage {
  const s = status.toUpperCase();
  if (s === "DELIVERED" || s === "DONE") return "delivered";
  if (s === "CONFIRMING" || s === "VERIFYING") return "confirming";
  if (s === "INFLIGHT" || s === "IN_FLIGHT") return "inflight";
  return "submitted";
}

function formatUSDT(raw: string): string {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return raw;
  return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 2 : 6).replace(/\.?0+$/, "");
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "any moment now";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `~${s}s`;
  return `~${m}m ${s}s`;
}

// ---------------------------------------------------------------------------
// Internal Sub-Components
// ---------------------------------------------------------------------------

function ChainDropdown({
  label,
  value,
  onChange,
  exclude,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  exclude?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex-1 w-full min-w-0">
      <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-2 block">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none bg-[var(--color-surface)] text-white text-sm rounded-lg px-3 py-2.5 pr-8 border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-brand)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <optgroup label="Major">
            {BRIDGE_CHAINS.filter((c) => c.category === "major" && c.id !== exclude).map((chain) => (
              <option key={chain.id} value={chain.id}>{chain.name}</option>
            ))}
          </optgroup>
          <optgroup label="L2 / L3">
            {BRIDGE_CHAINS.filter((c) => c.category === "l2" && c.id !== exclude).map((chain) => (
              <option key={chain.id} value={chain.id}>{chain.name}</option>
            ))}
          </optgroup>
          <optgroup label="Other Networks">
            {BRIDGE_CHAINS.filter((c) => c.category === "other" && c.id !== exclude).map((chain) => (
              <option key={chain.id} value={chain.id}>{chain.name}</option>
            ))}
          </optgroup>
        </select>
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {/* Selected chain logo indicator */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <ChainLogo
          family={"evm"}
          size={12}
        />
        <span className="text-[10px] text-[var(--color-muted)]">
          {BRIDGE_CHAINS.find((c) => c.id === value)?.name ?? value}
        </span>
      </div>
    </div>
  );
}

function QuotePreview({ quote, amount }: { quote: Quote; amount: string }) {
  const sendAmount = formatUSDT(quote.amountToSend);
  const receiveAmount = formatUSDT(quote.minAmountToReceive);
  const fromName = BRIDGE_CHAINS.find((c) => c.id === quote.fromChain)?.name ?? quote.fromChain;
  const toName = BRIDGE_CHAINS.find((c) => c.id === quote.toChain)?.name ?? quote.toChain;

  return (
    <div className="glass-card p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted)]">You send</span>
        <span className="text-sm font-medium text-white">{sendAmount} USDT0</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted)]">You receive</span>
        <span className="text-sm font-medium text-[var(--color-success)]">
          &ge; {receiveAmount} USDT0
          <span className="text-[10px] text-[var(--color-muted)] ml-1">(0.5% slippage protection)</span>
        </span>
      </div>
      <div className="border-t border-[var(--color-border)] my-1" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted)]">Bridge fee</span>
        <span className="text-xs text-white">{quote.nativeFeeFormatted}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted)]">T402 fee</span>
        <span className="text-xs text-white">0.01 USDT</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted)]">Est. time</span>
        <span className="text-xs text-white flex items-center gap-1">
          <Clock size={10} className="text-[var(--color-muted)]" />
          {quote.estimatedTimeFormatted}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted)]">Route</span>
        <span className="text-xs text-white flex items-center gap-1">
          {fromName}
          <ArrowRight size={10} className="text-[var(--color-scenario-bridge)]" />
          {toName} via LayerZero V2
        </span>
      </div>
      {quote.sufficientLiquidity === false && (
        <div className="flex items-center gap-2 p-2 rounded-lg mt-1" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <span className="text-[10px]" style={{ color: "var(--color-error)" }}>
            ⚠ Insufficient bridge liquidity ({quote.bridgeLiquidityFormatted || "0"} available). Try a smaller amount.
          </span>
        </div>
      )}
      {quote.simulated && (
        <p className="text-[10px] text-[var(--color-muted)] italic">
          Simulated quote — real LayerZero OFT fees may vary
        </p>
      )}
    </div>
  );
}

function BridgeStepper({
  currentStage,
  startTime,
  estimatedRemaining,
  srcTxHash,
  dstTxHash,
  layerZeroScanUrl,
  fromChain,
}: {
  currentStage: TrackingStage;
  startTime: number;
  estimatedRemaining: number;
  srcTxHash: string | null;
  dstTxHash: string | null;
  layerZeroScanUrl: string;
  fromChain: string;
}) {
  const currentIdx = stageIndex(currentStage);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const remaining = Math.max(0, estimatedRemaining - elapsed);

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Horizontal stepper */}
      <div className="flex items-center justify-between">
        {TRACKING_STAGES.map((stage, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          const isPending = idx > currentIdx;

          return (
            <div key={stage.key} className="flex items-center flex-1 last:flex-none">
              {/* Circle + label */}
              <div className="flex flex-col items-center gap-1 min-w-[60px]">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium transition-all ${
                    isDone
                      ? "bg-[var(--color-success)] text-white"
                      : isActive
                        ? "bg-[var(--color-scenario-bridge)] text-white animate-pulse"
                        : "bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle size={14} />
                  ) : isActive ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <span className="opacity-50">{idx + 1}</span>
                  )}
                </div>
                <span
                  className={`text-[10px] whitespace-nowrap ${
                    isDone
                      ? "text-[var(--color-success)]"
                      : isActive
                        ? "text-white font-medium"
                        : "text-[var(--color-muted)]"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {/* Connecting line */}
              {idx < TRACKING_STAGES.length - 1 && (
                <div className="flex-1 mx-1">
                  <div
                    className={`h-px ${
                      idx < currentIdx
                        ? "bg-[var(--color-success)]"
                        : "bg-[var(--color-border)]"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status text + countdown */}
      <div className="text-center space-y-1">
        <p className="text-xs text-white">
          {currentStage === "submitted" && "Payment confirmed — initiating bridge transfer..."}
          {currentStage === "inflight" && "LayerZero message sent — cross-chain transfer in progress..."}
          {currentStage === "confirming" && "DVN verification in progress — almost there..."}
          {currentStage === "delivered" && "Bridge transfer complete!"}
        </p>
        {currentStage !== "delivered" && (
          <p className="text-[10px] text-[var(--color-muted)] flex items-center justify-center gap-1">
            <Clock size={10} />
            Estimated: {formatCountdown(remaining)}
          </p>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px]">
        {srcTxHash && CHAIN_EXPLORERS[fromChain] && (
          <a
            href={`${CHAIN_EXPLORERS[fromChain]}${srcTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand)] hover:underline flex items-center gap-0.5"
          >
            Source tx <ExternalLink size={8} />
          </a>
        )}
        {layerZeroScanUrl && (
          <a
            href={layerZeroScanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand)] hover:underline flex items-center gap-0.5"
          >
            LayerZero Scan <ExternalLink size={8} />
          </a>
        )}
        {dstTxHash && (
          <a
            href={`https://layerzeroscan.com/tx/${dstTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand)] hover:underline flex items-center gap-0.5"
          >
            Dest tx <ExternalLink size={8} />
          </a>
        )}
      </div>
    </div>
  );
}

function SuccessState({
  amount,
  toChain,
  srcTxHash,
  dstTxHash,
  layerZeroScanUrl,
  fromChain,
  startTime,
  onReset,
}: {
  amount: string;
  toChain: string;
  srcTxHash: string | null;
  dstTxHash: string | null;
  layerZeroScanUrl: string;
  fromChain: string;
  startTime: number;
  onReset: () => void;
}) {
  const toName = BRIDGE_CHAINS.find((c) => c.id === toChain)?.name ?? toChain;
  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedRemSec = elapsedSec % 60;
  const displayAmount = formatUSDT(amount);

  return (
    <div className="glass-card p-6 space-y-4 text-center" style={{ borderColor: "var(--color-success)", borderWidth: 1 }}>
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-[var(--color-success)] bg-opacity-20 flex items-center justify-center">
          <CheckCircle size={24} className="text-[var(--color-success)]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-success)]">Bridge Complete</h3>
        <p className="text-xs text-white">
          {displayAmount} USDT0 delivered to {toName}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px]">
        {srcTxHash && CHAIN_EXPLORERS[fromChain] && (
          <a
            href={`${CHAIN_EXPLORERS[fromChain]}${srcTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand)] hover:underline flex items-center gap-0.5"
          >
            Source tx <ExternalLink size={8} />
          </a>
        )}
        {dstTxHash && (
          <a
            href={`https://layerzeroscan.com/tx/${dstTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand)] hover:underline flex items-center gap-0.5"
          >
            Dest tx <ExternalLink size={8} />
          </a>
        )}
        {layerZeroScanUrl && (
          <a
            href={layerZeroScanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand)] hover:underline flex items-center gap-0.5"
          >
            LayerZero Scan <ExternalLink size={8} />
          </a>
        )}
      </div>

      <p className="text-[10px] text-[var(--color-muted)]">
        Elapsed: {elapsedMin > 0 ? `${elapsedMin}m ` : ""}{elapsedRemSec}s
      </p>

      <button onClick={onReset} className="btn-primary px-4 py-2 text-xs mx-auto">
        <ArrowLeftRight size={12} className="inline mr-1" />
        Bridge again
      </button>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="glass-card p-5 space-y-3 text-center" style={{ borderColor: "var(--color-error)", borderWidth: 1 }}>
      <div className="flex flex-col items-center gap-2">
        <AlertCircle size={20} className="text-[var(--color-error)]" />
        <p className="text-xs text-[var(--color-error)]">{error}</p>
      </div>
      <button onClick={onRetry} className="btn-primary px-4 py-2 text-xs mx-auto">
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CrossChainBridge() {
  const { isDemo, testnet } = useDemoContext();
  const { signPayment, activeFamily, activeNetwork, address: walletAddress } = useMultiChainPayment();
  const { ensureChain } = useEvmChainSync();

  // Form state
  const [fromChain, setFromChain] = useState("arbitrum");
  const [toChain, setToChain] = useState("ethereum");
  const [amountInput, setAmountInput] = useState("0.01");

  // Bridge state machine
  const [state, setState] = useState<BridgeState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Quote
  const [quote, setQuote] = useState<Quote | null>(null);
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payment flow
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);

  // Tracking
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [trackingStage, setTrackingStage] = useState<TrackingStage>("submitted");
  const [bridgeStartTime, setBridgeStartTime] = useState(0);
  const [estimatedRemaining, setEstimatedRemaining] = useState(300);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived
  const amountRaw = Math.round(parseFloat(amountInput || "0") * 1_000_000);
  const amountValid = !isNaN(amountRaw) && amountRaw > 0;
  const formDisabled = state !== "idle" && state !== "quoted" && state !== "failed";

  // ---------------------------------------------------------------------------
  // Quote fetching with debounce
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);

    if (!amountValid || fromChain === toChain) {
      setQuote(null);
      if (state === "quoted" || state === "quoting") setState("idle");
      return;
    }

    setState("quoting");

    quoteTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/demo/bridge/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromChain,
            toChain,
            amount: String(amountRaw),
          }),
        });
        const data = await res.json();
        setQuote(data);
        setState("quoted");
      } catch {
        setQuote(null);
        setState("idle");
      }
    }, 500);

    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromChain, toChain, amountInput]);

  // ---------------------------------------------------------------------------
  // Status polling
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state !== "tracking" || !tracking) return;

    const poll = async () => {
      try {
        const params = tracking.real
          ? `real=true&txHash=${tracking.srcTxHash}`
          : `guid=${tracking.guid}`;
        const res = await fetch(`/api/demo/bridge/status?${params}`);
        if (!res.ok) return;
        const data = await res.json();

        // status can be a string ("DELIVERED") or an object ({ name: "DELIVERED", message: "..." })
        const rawStatus = data.status;
        const newStatus = typeof rawStatus === "object" && rawStatus?.name
          ? rawStatus.name
          : typeof rawStatus === "string"
            ? rawStatus
            : "SUBMITTED";
        const newStage = statusToStage(newStatus);
        setTrackingStage(newStage);

        if (data.estimatedTimeRemaining !== undefined) {
          // Normalize ms → seconds
          const raw = data.estimatedTimeRemaining;
          setEstimatedRemaining(raw > 10000 ? Math.ceil(raw / 1000) : raw);
        }

        setTracking((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                dstTxHash: data.dstTxHash ?? prev.dstTxHash,
              }
            : prev
        );

        if (newStage === "delivered") {
          setState("delivered");
        }
      } catch {
        // Polling failure is non-critical
      }
    };

    pollRef.current = setInterval(poll, 5000);
    // Run once immediately
    poll();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state, tracking]);

  // Simulate progression for demo mode (simulated bridges)
  useEffect(() => {
    if (state !== "tracking") return;
    if (tracking?.real) return; // Real bridges use API polling

    const stages: TrackingStage[] = ["submitted", "inflight", "confirming", "delivered"];
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      if (idx < stages.length) {
        setTrackingStage(stages[idx]);
        if (stages[idx] === "delivered") {
          setState("delivered");
        }
      } else {
        clearInterval(timer);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [state, tracking?.real]);

  // ---------------------------------------------------------------------------
  // Bridge execution (402 payment flow)
  // ---------------------------------------------------------------------------
  const executeBridge = useCallback(async () => {
    setState("paying");
    setError(null);
    setFlowState("requesting");
    setSettle(null);
    setTracking(null);
    setTrackingStage("submitted");

    try {
      // Ensure wallet is on the FROM chain before T402 payment
      const targetChainId = BRIDGE_CHAIN_IDS[fromChain];
      if (targetChainId) await ensureChain(targetChainId);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-preferred-chain": "evm",
        "x-network-mode": "mainnet",
        "x-preferred-network": CHAIN_CAIP2[fromChain] || "eip155:42161",
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      const body = JSON.stringify({
        sourceChain: fromChain,
        targetChain: toChain,
        amount: String(amountRaw),
        // Send user's wallet address as bridge recipient
        // so bridged tokens go to the USER, not the Facilitator
        ...(walletAddress && walletAddress !== "demo-wallet" && { recipient: walletAddress }),
      });

      // Step 1: Get 402
      const res = await fetch("/api/demo/bridge", { method: "POST", headers, body });

      if (res.status === 402) {
        setFlowState("got-402");
        const paymentRequired = await res.json();
        // Pick the accept matching the FROM chain's CAIP-2 (not just [0])
        const targetNetwork = CHAIN_CAIP2[fromChain] || "eip155:42161";
        const requirements = paymentRequired.accepts?.find(
          (a: { network: string }) => a.network === targetNetwork
        ) || paymentRequired.accepts?.[0];
        if (!requirements) throw new Error("No payment options available");

        // Step 2: Sign
        setFlowState("signing");
        // Force EVM family for payment signing (Bridge is always EVM)
        const paymentPayload = await signPayment(requirements, (step) => {
          if (step === "approving") setFlowState("approving");
          if (step === "signing") setFlowState("signing");
        }, "evm");

        setState("bridging");

        // Step 3: Retry with payment
        const retryHeaders: Record<string, string> = {
          ...headers,
          "Payment-Signature": encodePaymentHeader(paymentPayload),
        };

        setFlowState("retrying");
        const retryRes = await fetch("/api/demo/bridge", { method: "POST", headers: retryHeaders, body });
        setFlowState("verifying");
        setSettle(parsePaymentResponse(retryRes));

        const data = await retryRes.json();

        if (!data.success) {
          throw new Error(data.error || "Bridge request failed");
        }

        // Check if real bridge failed (payment succeeded but bridge execution failed)
        if (data.bridge?.error) {
          throw new Error(data.bridge.error);
        }

        // Extract tracking info
        const msg = data.message || {};
        const isReal = data.bridge?.real === true;
        const srcTx = data.bridge?.txHash || msg.srcTxHash || null;
        const guid = msg.guid || "simulated";
        const lzUrl = data.tracking?.layerZeroScan || `https://layerzeroscan.com/tx/${srcTx || guid}`;

        setTracking({
          guid,
          status: msg.status || "SUBMITTED",
          srcTxHash: srcTx,
          dstTxHash: null,
          layerZeroScanUrl: lzUrl,
          real: isReal,
        });

        // estimatedTimeRemaining from API is in ms, estimatedTime is in seconds
        const rawEst = msg.estimatedTimeRemaining ?? msg.estimatedTime ?? 300;
        // Normalize to seconds (if > 10000, assume milliseconds)
        const estTime = rawEst > 10000 ? Math.ceil(rawEst / 1000) : rawEst;
        setEstimatedRemaining(estTime);
        setBridgeStartTime(Date.now());
        setState("tracking");
        setFlowState("done");
      } else if (res.ok) {
        // Unusual: 200 without 402 flow
        const data = await res.json();
        setTracking({
          guid: data.message?.guid || "direct",
          status: "SUBMITTED",
          srcTxHash: data.bridge?.txHash || null,
          dstTxHash: null,
          layerZeroScanUrl: data.tracking?.layerZeroScan || "",
          real: data.bridge?.real,
        });
        setBridgeStartTime(Date.now());
        setState("tracking");
        setFlowState("done");
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }
    } catch (err) {
      console.error("[bridge] Error:", err);
      const msg = err instanceof Error ? err.message : "Bridge failed";
      setError(msg);
      setFlowState("error");
      setState("failed");
    }
  }, [isDemo, activeFamily, activeNetwork, testnet, signPayment, fromChain, toChain, amountRaw, ensureChain, walletAddress]);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setQuote(null);
    setFlowState("idle");
    setSettle(null);
    setTracking(null);
    setTrackingStage("submitted");
    setBridgeStartTime(0);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // ---------------------------------------------------------------------------
  // Ensure fromChain !== toChain
  // ---------------------------------------------------------------------------
  const handleFromChange = useCallback(
    (id: string) => {
      setFromChain(id);
      if (id === toChain) {
        const alt = BRIDGE_CHAINS.find((c) => c.id !== id);
        if (alt) setToChain(alt.id);
      }
      // Switch wallet to match the FROM chain
      const cid = BRIDGE_CHAIN_IDS[id];
      if (cid) ensureChain(cid);
    },
    [toChain, ensureChain]
  );

  const handleToChange = useCallback(
    (id: string) => {
      setToChain(id);
      if (id === fromChain) {
        const alt = BRIDGE_CHAINS.find((c) => c.id !== id);
        if (alt) setFromChain(alt.id);
      }
    },
    [fromChain]
  );

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const toName = BRIDGE_CHAINS.find((c) => c.id === toChain)?.name ?? toChain;
  const displayAmount = amountValid ? formatUSDT(String(amountRaw)) : "0";
  const showForm = state === "idle" || state === "quoting" || state === "quoted" || state === "failed";
  const showTracking = state === "tracking";
  const showSuccess = state === "delivered";
  const showPaying = state === "paying" || state === "bridging";

  return (
    <div className="space-y-6 overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* A. Bridge Form                                                     */}
      {/* ------------------------------------------------------------------ */}
      {showForm && (
        <div className="glass-card p-6 overflow-hidden">
          {/* Chain selectors */}
          <div className="flex flex-col sm:flex-row items-end gap-4 mb-5">
            <ChainDropdown
              label="From"
              value={fromChain}
              onChange={handleFromChange}
              exclude={undefined}
              disabled={formDisabled}
            />

            {/* Swap button */}
            <button
              onClick={() => {
                const prev = fromChain;
                setFromChain(toChain);
                setToChain(prev);
                // Switch wallet to match new FROM chain
                const cid = BRIDGE_CHAIN_IDS[toChain];
                if (cid) ensureChain(cid);
              }}
              disabled={formDisabled}
              className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-active)] transition-colors disabled:opacity-50"
              title="Swap chains"
            >
              <ArrowLeftRight size={14} className="text-[var(--color-scenario-bridge)]" />
            </button>

            <ChainDropdown
              label="To"
              value={toChain}
              onChange={handleToChange}
              exclude={fromChain}
              disabled={formDisabled}
            />
          </div>
          <div className="mb-4">
            <WalletChainIndicator expectedChainId={BRIDGE_CHAIN_IDS[fromChain]} />
          </div>

          {/* Amount input */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-2 block">
              Amount
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => {
                  const v = e.target.value;
                  // Allow empty, digits, one decimal point
                  if (v === "" || /^\d*\.?\d*$/.test(v)) {
                    setAmountInput(v);
                  }
                }}
                disabled={formDisabled}
                className="w-full bg-[var(--color-surface)] text-white text-sm rounded-lg px-3 py-2.5 pr-16 border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-brand)] transition-colors disabled:opacity-50 font-mono"
                placeholder="0.01"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)] font-medium">
                USDT0
              </span>
            </div>
            {amountInput !== "" && !amountValid && (
              <p className="text-[10px] text-[var(--color-error)] mt-1">Enter a valid amount greater than 0</p>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* B. Quote + Button (inside the form card)                           */}
      {/* ------------------------------------------------------------------ */}
      {showForm && (
        <div className="space-y-3">
          {state === "quoting" && (
            <div className="glass-card p-3 flex items-center justify-center gap-2">
              <Spinner size="sm" />
              <span className="text-xs text-[var(--color-muted)]">Fetching quote...</span>
            </div>
          )}

          {state === "quoted" && quote && (
            <QuotePreview quote={quote} amount={String(amountRaw)} />
          )}

          {/* Payment flow status */}
          {flowState !== "idle" && flowState !== "done" && (
            <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
          )}

          {state === "failed" && error && (
            <ErrorState error={error} onRetry={reset} />
          )}

          {state !== "failed" && (
            <button
              onClick={executeBridge}
              disabled={!amountValid || !quote || state === "quoting" || fromChain === toChain || quote?.sufficientLiquidity === false}
              className="btn-primary px-4 py-3 text-sm w-full min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChainLogo
                family={"evm"}
                size={14}
              />
              Bridge {displayAmount} USDT0
              <ArrowRight size={14} />
              {toName}
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Paying / Bridging spinner                                          */}
      {/* ------------------------------------------------------------------ */}
      {showPaying && (
        <div className="glass-card p-5 flex items-center gap-3">
          <Spinner />
          <span className="text-sm text-[var(--color-muted)]">
            {state === "paying" && "Signing payment authorization..."}
            {state === "bridging" && "Submitting bridge transaction via LayerZero V2..."}
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* D. Bridge Progress (tracking state)                                */}
      {/* ------------------------------------------------------------------ */}
      {showTracking && tracking && (
        <BridgeStepper
          currentStage={trackingStage}
          startTime={bridgeStartTime}
          estimatedRemaining={estimatedRemaining}
          srcTxHash={tracking.srcTxHash}
          dstTxHash={tracking.dstTxHash}
          layerZeroScanUrl={tracking.layerZeroScanUrl}
          fromChain={fromChain}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* E. Success State (delivered)                                       */}
      {/* ------------------------------------------------------------------ */}
      {showSuccess && tracking && (
        <SuccessState
          amount={String(amountRaw)}
          toChain={toChain}
          srcTxHash={tracking.srcTxHash}
          dstTxHash={tracking.dstTxHash}
          layerZeroScanUrl={tracking.layerZeroScanUrl}
          fromChain={fromChain}
          startTime={bridgeStartTime}
          onReset={reset}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SDK Examples                                                       */}
      {/* ------------------------------------------------------------------ */}
      {/* SdkExamples rendered by ScenarioShell via scenarioId */}

      {/* ------------------------------------------------------------------ */}
      {/* Explainer                                                          */}
      {/* ------------------------------------------------------------------ */}
      <p className="text-xs text-[var(--color-muted)]">
        Cross-chain payments use LayerZero USDT0 OFT standard. Pay on any chain, receive on any other
        — the facilitator handles bridging automatically. All 22 EVM chains supported including Arbitrum,
        Ethereum, Optimism, Polygon, and more.
      </p>
    </div>
  );
}
