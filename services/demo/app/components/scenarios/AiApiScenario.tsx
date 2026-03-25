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
import { classifyError, getUserFriendlyMessage, getErrorAction } from "@/lib/error-helpers";
import { Bot } from "lucide-react";

type State = "idle" | "paying" | "streaming" | "done" | "error";

interface AiResult {
  query: string;
  response: string;
  model: string;
  cost: string;
}

const EXAMPLE_QUERIES = [
  "What is HTTP 402 and how does T402 use it?",
  "Explain USDT0 cross-chain transfers",
  "How do AI agents pay for API calls?",
  "What is EIP-3009 TransferWithAuthorization?",
];

export function AiApiScenario() {
  const { isDemo, testnet } = useDemoContext();
  const { signPayment, activeFamily, activeNetwork } = useMultiChainPayment();
  const [query, setQuery] = useState(EXAMPLE_QUERIES[0]);
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalQueries, setTotalQueries] = useState(0);
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
        "Content-Type": "application/json",
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
        ...(activeNetwork ? { "x-preferred-network": activeNetwork } : {}),
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      // Step 1: Initial request (will get 402)
      const initialResponse = await fetch("/api/demo/ai-query", {
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
      });

      if (initialResponse.status !== 402) {
        throw new Error(`Unexpected status: ${initialResponse.status}`);
      }

      setFlowState("got-402");
      const paymentRequired = await initialResponse.json();

      // Step 2: Sign payment via multi-chain hook
      const requirements = paymentRequired.accepts?.[0];
      if (!requirements) throw new Error("No payment options available");
      setFlowState("signing");
      const paymentPayload = await signPayment(requirements, (step) => {
        if (step === "approving") setFlowState("approving");
        if (step === "signing") setFlowState("signing");
      });

      setState("streaming");

      // Step 3: Retry with payment
      const retryHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
        ...(activeNetwork ? { "x-preferred-network": activeNetwork } : {}),
        "Payment-Signature": encodePaymentHeader(paymentPayload),
      };
      if (isDemo) retryHeaders["x-demo-mode"] = "true";

      setFlowState("retrying");
      const retryResponse = await fetch("/api/demo/ai-query", {
        method: "POST",
        headers: retryHeaders,
        body: JSON.stringify({ query }),
      });

      setFlowState("verifying");
      setSettle(parsePaymentResponse(retryResponse));

      if (!retryResponse.ok) {
        const errBody = await retryResponse.json().catch(() => null);
        const reason = errBody?.reason || errBody?.error || `status ${retryResponse.status}`;
        throw new Error(reason);
      }

      const data: AiResult = await retryResponse.json();
      setResult(data);
      setTotalQueries((n) => n + 1);
      setState("done");
      setFlowState("done");
    } catch (err) {
      const originalMessage = err instanceof Error ? err.message : String(err);
      setError(originalMessage);
      setState("error");
      setFlowState("error");
    }
  }, [query, isDemo, activeFamily, activeNetwork, testnet, signPayment]);

  return (
    <>
    {flowState !== "idle" && (
      <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
    )}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input */}
      <div className="flex flex-col gap-4">
        <div className="glass-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm font-medium">Query</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-brand-dim)] text-[var(--color-brand)]">
              0.001 USDT/query
            </span>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[var(--color-code-bg)] border border-[var(--color-border)] rounded-lg p-3 text-sm font-mono text-[var(--color-code-text)] resize-none focus:outline-none focus:border-[var(--color-brand)]"
            rows={3}
            placeholder="Ask anything..."
          />
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-md border transition-colors cursor-pointer active:scale-95 ${
                  query === q
                    ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-white"
                }`}
              >
                <span className="sm:hidden">{q.slice(0, 20)}...</span>
                <span className="hidden sm:inline">{q.slice(0, 30)}...</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={execute}
          disabled={state === "paying" || state === "streaming"}
          className="btn-primary w-full py-3 min-h-[48px] flex items-center justify-center gap-2"
        >
          {state === "paying" || state === "streaming" ? (
            <>
              <Spinner size="sm" color="white" />
              {state === "paying" ? "Paying..." : "Generating..."}
            </>
          ) : (
            <>Pay & Query</>
          )}
        </button>

        {totalQueries > 0 && (
          <p className="text-xs text-[var(--color-muted)] text-center">
            {totalQueries} queries · {(totalQueries * 0.001).toFixed(3)} USDT spent
          </p>
        )}
      </div>

      {/* Right: Response */}
      <div className="flex flex-col gap-3">
        {state === "idle" && (
          <div className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center min-h-[200px] sm:min-h-[240px] text-center">
            <Bot size={32} className="mb-3" style={{ color: "var(--color-scenario-ai)" }} />
            <p className="text-sm text-[var(--color-muted)]">
              AI response will appear here after payment
            </p>
          </div>
        )}

        {(state === "paying" || state === "streaming") && (
          <div className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center min-h-[200px] sm:min-h-[240px]">
            <Spinner size="lg" color="var(--color-brand)" />
            <p className="text-sm text-[var(--color-muted)] mt-4">
              {state === "paying" ? "Processing USDT payment..." : "Generating response..."}
            </p>
          </div>
        )}

        {state === "done" && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--color-muted)]">
                  Model: {result.model}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-success-dim)] text-[var(--color-success)]">
                  Paid {result.cost}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{result.response}</p>
            </div>
            <CodeBlock
              code={JSON.stringify({ query: result.query, cost: result.cost, model: result.model }, null, 2)}
              language="json"
              label="Response Metadata"
              labelColor="var(--color-muted)"
              maxHeight="120px"
            />
          </motion.div>
        )}

        {state === "error" && (
          <div className="glass-card p-4 sm:p-6 text-center">
            <p className="text-sm text-[var(--color-error)]">
              {error ? getUserFriendlyMessage(classifyError(error), error) : "An unknown error occurred."}
            </p>
            {error && (
              <p className="text-[10px] mt-1" style={{ color: "var(--color-muted)" }}>
                {getErrorAction(classifyError(error), activeFamily) || "Try again or switch to Demo mode."}
              </p>
            )}
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
