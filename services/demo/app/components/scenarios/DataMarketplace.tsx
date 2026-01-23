"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { useDemoContext } from "@/providers/DemoProvider";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { Spinner } from "@/components/shared/Spinner";

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
  const { isDemo } = useDemoContext();
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState(0);

  const execute = useCallback(async () => {
    setState("paying");
    setResult(null);
    setError(null);

    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (isDemo) headers["x-demo-mode"] = "true";

      // Step 1: Get 402
      const initialResponse = await fetch(`/api/demo/${selectedEndpoint.id}`, { headers });

      if (initialResponse.status !== 402) {
        throw new Error(`Unexpected status: ${initialResponse.status}`);
      }

      const paymentRequired = await initialResponse.json();
      const requirements = paymentRequired.accepts[0];

      await new Promise((r) => setTimeout(r, 400));

      // Step 2: Sign & retry
      const paymentPayload = {
        t402Version: 2,
        scheme: "exact",
        network: requirements.network,
        payload: {
          authorization: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
            to: requirements.payTo,
            value: requirements.amount,
            validAfter: 0,
            validBefore: Math.floor(Date.now() / 1000) + 60,
            nonce: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
          },
          signature: "0x" + Array.from({ length: 130 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        },
      };

      const retryHeaders: Record<string, string> = {
        Accept: "application/json",
        "Payment-Signature": btoa(JSON.stringify(paymentPayload)),
      };
      if (isDemo) retryHeaders["x-demo-mode"] = "true";

      const retryResponse = await fetch(`/api/demo/${selectedEndpoint.id}`, { headers: retryHeaders });

      if (!retryResponse.ok) {
        throw new Error(`Request failed: ${retryResponse.status}`);
      }

      const data = await retryResponse.json();
      setResult(data);
      setPurchases((n) => n + 1);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [isDemo, selectedEndpoint]);

  return (
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
          className="w-full py-3 rounded-xl bg-[var(--color-brand)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer flex items-center justify-center gap-2"
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
          <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[260px] text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-sm text-[var(--color-muted)]">
              Select a data feed and purchase access
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Pay-per-request — no subscriptions needed
            </p>
          </div>
        )}

        {state === "paying" && (
          <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[260px]">
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
              onClick={() => { setState("idle"); setResult(null); }}
              className="mt-3 text-xs text-[var(--color-muted)] hover:text-white cursor-pointer"
            >
              Purchase again
            </button>
          </motion.div>
        )}

        {state === "error" && (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
            <button
              onClick={() => setState("idle")}
              className="mt-3 text-xs text-[var(--color-muted)] hover:text-white cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
