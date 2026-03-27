"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { PaymentStatus, parsePaymentResponse, type SettleInfo } from "@/components/shared/PaymentStatus";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { Spinner } from "@/components/shared/Spinner";
import { encodePaymentHeader } from "@/lib/t402-client";
import { BarChart3 } from "lucide-react";

type State = "idle" | "paying" | "done" | "error";

interface MarketData {
  data: {
    symbol: string;
    price: string;
    volume24h: string;
    change24h: string;
    high24h: string;
    low24h: string;
    timestamp: string;
  };
}

const ENDPOINTS = [
  { id: "market-data", label: "BTC/USDT Feed", cost: "0.001", description: "Real-time price data" },
  { id: "premium-report", label: "Premium Report", cost: "0.005", description: "Analyst research" },
];

export function DataMarketplace() {
  const { isDemo, testnet } = useDemoContext();
  const { signPayment, activeFamily, activeNetwork } = useMultiChainPayment();
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState(0);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);

  const execute = useCallback(async () => {
    setState("paying");
    setResult(null);
    setError(null);
    setFlowState("requesting");
    setSettle(null);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
        ...(activeNetwork ? { "x-preferred-network": activeNetwork } : {}),
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      // Step 1: Get 402
      const initialResponse = await fetch(`/api/demo/${selectedEndpoint.id}`, { headers });

      if (initialResponse.status !== 402) {
        throw new Error(`Unexpected status: ${initialResponse.status}`);
      }

      setFlowState("got-402");
      const paymentRequired = await initialResponse.json();
      const requirements = paymentRequired.accepts?.[0];
      if (!requirements) throw new Error("No payment options available");

      // Step 2: Sign via multi-chain hook & retry
      setFlowState("signing");
      const paymentPayload = await signPayment(requirements, (step) => {
        if (step === "switching-chain") setFlowState("switching-chain" as FlowState);
        if (step === "approving") setFlowState("approving");
        if (step === "signing") setFlowState("signing");
      });

      const retryHeaders: Record<string, string> = {
        Accept: "application/json",
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
        ...(activeNetwork ? { "x-preferred-network": activeNetwork } : {}),
        "Payment-Signature": encodePaymentHeader(paymentPayload),
      };
      if (isDemo) retryHeaders["x-demo-mode"] = "true";

      setFlowState("retrying");
      const retryResponse = await fetch(`/api/demo/${selectedEndpoint.id}`, { headers: retryHeaders });

      setFlowState("verifying");
      setSettle(parsePaymentResponse(retryResponse));

      if (!retryResponse.ok) {
        const errBody = await retryResponse.json().catch(() => null);
        const reason = errBody?.reason || errBody?.error || `status ${retryResponse.status}`;
        throw new Error(reason);
      }

      const data = await retryResponse.json();
      setResult(data);
      setPurchases((n) => n + 1);
      setState("done");
      setFlowState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      setFlowState("error");
    }
  }, [isDemo, activeFamily, activeNetwork, testnet, signPayment, selectedEndpoint]);

  return (
    <>
    {flowState !== "idle" && (
      <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
    )}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Endpoint selection */}
      <div className="flex flex-col gap-4">
        <div className="glass-card p-5">
          <h4 className="text-sm font-medium mb-3">Available Data Feeds</h4>
          <div className="space-y-2">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.id}
                onClick={() => setSelectedEndpoint(ep)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedEndpoint.id === ep.id
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-dim)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-muted)]"
                }`}
              >
                <div className="text-left">
                  <p className="text-sm font-medium">{ep.label}</p>
                  <p className="text-xs text-[var(--color-muted)]">{ep.description}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-brand)]">
                  {ep.cost} USDT
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={execute}
          disabled={state === "paying"}
          className="btn-primary w-full py-3 min-h-[44px] flex items-center justify-center gap-2"
        >
          {state === "paying" ? (
            <>
              <Spinner size="sm" color="white" />
              Purchasing...
            </>
          ) : (
            <>Purchase Data — {selectedEndpoint.cost} USDT</>
          )}
        </button>

        {purchases > 0 && (
          <p className="text-xs text-[var(--color-muted)] text-center">
            {purchases} purchases this session
          </p>
        )}
      </div>

      {/* Right: Result */}
      <div>
        {state === "idle" && (
          <div className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center min-h-[220px] sm:min-h-[260px] text-center">
            <BarChart3 size={32} className="mb-3" style={{ color: "var(--color-scenario-data)" }} />
            <p className="text-sm text-[var(--color-muted)]">
              Select a data feed and purchase access
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Pay-per-request — no subscriptions needed
            </p>
          </div>
        )}

        {state === "paying" && (
          <div className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center min-h-[220px] sm:min-h-[260px]">
            <Spinner size="lg" color="var(--color-brand)" />
            <p className="text-sm text-[var(--color-muted)] mt-4">Processing micropayment...</p>
          </div>
        )}

        {state === "done" && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <CodeBlock
              code={JSON.stringify(result, null, 2)}
              language="json"
              label={`${selectedEndpoint.label} — Paid ${selectedEndpoint.cost} USDT`}
              labelColor="var(--color-success)"
              showCopyButton
              maxHeight="300px"
            />
            <button
              onClick={() => { setState("idle"); setResult(null); setFlowState("idle"); setSettle(null); }}
              className="mt-3 text-xs text-[var(--color-muted)] hover:text-white cursor-pointer"
            >
              Purchase again
            </button>
          </motion.div>
        )}

        {state === "error" && (
          <div className="glass-card p-4 sm:p-6 text-center">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
            <button
              onClick={() => { setState("idle"); setFlowState("idle"); setSettle(null); }}
              className="mt-3 text-xs text-[var(--color-muted)] hover:text-white cursor-pointer min-h-[36px]"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
