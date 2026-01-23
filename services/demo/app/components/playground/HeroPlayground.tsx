"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { usePaymentFlow, type FlowState } from "@/hooks/usePaymentFlow";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { Spinner } from "@/components/shared/Spinner";

const FLOW_STEPS: { state: FlowState; label: string; description: string }[] = [
  { state: "idle", label: "Ready", description: "Click to start the 402 flow" },
  { state: "requesting", label: "GET Request", description: "Requesting protected resource..." },
  { state: "got-402", label: "402 Received", description: "Server requires payment" },
  { state: "signing", label: "Signing", description: "Signing USDT authorization..." },
  { state: "retrying", label: "Retry", description: "Resending with payment..." },
  { state: "verifying", label: "Verifying", description: "Facilitator settling on-chain..." },
  { state: "done", label: "200 OK", description: "Resource unlocked!" },
];

function getStepIndex(state: FlowState): number {
  if (state === "error") return -1;
  const idx = FLOW_STEPS.findIndex((s) => s.state === state);
  return idx >= 0 ? idx : 0;
}

export function HeroPlayground() {
  const flow = usePaymentFlow("/api/demo/market-data");
  const [showDetails, setShowDetails] = useState(true);
  const currentStep = getStepIndex(flow.state);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Flow Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          {FLOW_STEPS.map((step, i) => (
            <div key={step.state} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                    i < currentStep
                      ? "bg-[var(--color-brand)] text-white"
                      : i === currentStep && flow.state !== "idle"
                        ? "bg-[var(--color-brand)] text-white animate-pulse"
                        : "bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]"
                  }`}
                >
                  {i < currentStep ? "✓" : i + 1}
                </div>
                <span className={`text-[10px] mt-1.5 whitespace-nowrap ${
                  i <= currentStep && flow.state !== "idle" ? "text-white" : "text-[var(--color-muted)]"
                }`}>
                  {step.label}
                </span>
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div className={`w-8 sm:w-12 lg:w-16 h-px mx-1 transition-colors duration-300 ${
                  i < currentStep ? "bg-[var(--color-brand)]" : "bg-[var(--color-border)]"
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Action Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Action + Status */}
        <div className="flex flex-col gap-4">
          <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[280px]">
            {flow.state === "idle" ? (
              <div className="text-center">
                <div className="text-6xl mb-4">💳</div>
                <h3 className="text-lg font-medium mb-2">HTTP 402 Payment Flow</h3>
                <p className="text-sm text-[var(--color-muted)] mb-6 max-w-xs">
                  Experience the full T402 payment cycle: request → 402 → sign → pay → access
                </p>
                <button
                  onClick={flow.execute}
                  className="px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white font-medium hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Start Payment Flow
                </button>
              </div>
            ) : flow.state === "done" ? (
              <div className="text-center">
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="text-lg font-medium text-[var(--color-success)] mb-2">Payment Complete!</h3>
                <p className="text-sm text-[var(--color-muted)] mb-4">
                  Resource unlocked with 0.001 USDT micropayment
                </p>
                {flow.settleResponse?.transaction && (
                  <p className="font-mono text-xs text-[var(--color-muted)] mb-4 break-all">
                    tx: {flow.settleResponse.transaction.slice(0, 10)}...{flow.settleResponse.transaction.slice(-8)}
                  </p>
                )}
                <button
                  onClick={flow.reset}
                  className="px-5 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-muted)] hover:text-white transition-colors cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            ) : flow.state === "error" ? (
              <div className="text-center">
                <div className="text-5xl mb-3">⚠️</div>
                <h3 className="text-lg font-medium text-[var(--color-error)] mb-2">Error</h3>
                <p className="text-sm text-[var(--color-muted)] mb-4 max-w-xs">{flow.error}</p>
                <button
                  onClick={flow.reset}
                  className="px-5 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-muted)] hover:text-white transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>
            ) : (
              <div className="text-center">
                <Spinner size="lg" color="var(--color-brand)" />
                <h3 className="text-lg font-medium mt-4 mb-1">
                  {FLOW_STEPS[currentStep]?.label}
                </h3>
                <p className="text-sm text-[var(--color-muted)]">
                  {FLOW_STEPS[currentStep]?.description}
                </p>
              </div>
            )}
          </div>

          {/* Toggle details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-[var(--color-muted)] hover:text-white transition-colors cursor-pointer"
          >
            {showDetails ? "Hide" : "Show"} protocol details
          </button>
        </div>

        {/* Right: Protocol Details */}
        <AnimatePresence mode="wait">
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-3"
            >
              {flow.state === "got-402" && flow.paymentRequired && (
                <CodeBlock
                  code={JSON.stringify(flow.paymentRequired, null, 2)}
                  language="json"
                  label="402 Payment Required"
                  labelColor="var(--color-warning)"
                  maxHeight="260px"
                  showCopyButton
                />
              )}
              {(flow.state === "signing" || flow.state === "retrying" || flow.state === "verifying" || flow.state === "done") && flow.requestHeaders["Payment-Signature"] && (
                <CodeBlock
                  code={`Payment-Signature: ${flow.requestHeaders["Payment-Signature"].slice(0, 60)}...`}
                  language="http"
                  label="Payment Header"
                  labelColor="var(--color-info)"
                  maxHeight="80px"
                />
              )}
              {flow.state === "done" && flow.settleResponse && (
                <CodeBlock
                  code={JSON.stringify(flow.settleResponse, null, 2)}
                  language="json"
                  label="Settlement Result"
                  labelColor="var(--color-success)"
                  maxHeight="140px"
                  showCopyButton
                />
              )}
              {flow.state === "done" && !!flow.data && (
                <CodeBlock
                  code={JSON.stringify(flow.data, null, 2)}
                  language="json"
                  label="200 OK — Resource Data"
                  labelColor="var(--color-success)"
                  maxHeight="200px"
                  showCopyButton
                />
              )}
              {flow.state === "idle" && (
                <div className="glass-card p-6 text-center text-[var(--color-muted)]">
                  <p className="text-sm">Protocol details will appear here as the flow progresses.</p>
                  <div className="mt-4 font-mono text-xs space-y-1 text-left">
                    <p className="text-[var(--color-code-text-dim)]">GET /api/demo/market-data</p>
                    <p className="text-[var(--color-warning)]">← 402 Payment Required</p>
                    <p className="text-[var(--color-info)]">→ Payment-Signature: ...</p>
                    <p className="text-[var(--color-success)]">← 200 OK + Payment-Response</p>
                  </div>
                </div>
              )}
              {(flow.state === "requesting") && (
                <div className="glass-card p-6">
                  <CodeBlock
                    code={`GET /api/demo/market-data HTTP/1.1\nAccept: application/json`}
                    language="http"
                    label="Request"
                    labelColor="var(--color-info)"
                    maxHeight="100px"
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
