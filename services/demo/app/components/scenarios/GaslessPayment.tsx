"use client";

import { useState, useCallback } from "react";
import { Zap, Fuel, CheckCircle } from "lucide-react";
import { Spinner } from "@/components/shared/Spinner";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { PaymentStatus, parsePaymentResponse, type SettleInfo } from "@/components/shared/PaymentStatus";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { encodePaymentHeader } from "@/lib/t402-client";

type GaslessState = "idle" | "creating-userop" | "bundling" | "settling" | "done";

export function GaslessPayment() {
  const { isDemo, testnet } = useDemoContext();
  const { signPayment, activeFamily, activeNetwork } = useMultiChainPayment();
  const [state, setState] = useState<GaslessState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);

  const execute = useCallback(async () => {
    setState("creating-userop");
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

      // Get 402 from gasless API
      const res = await fetch("/api/demo/gasless", { method: "POST", headers });
      if (res.status === 402) {
        setFlowState("got-402");
        const paymentRequired = await res.json();
        const requirements = paymentRequired.accepts?.[0];
      if (!requirements) throw new Error("No payment options available");
        setFlowState("signing");
        const paymentPayload = await signPayment(requirements);

        setState("bundling");

        const retryHeaders: Record<string, string> = {
          ...headers,
          "Payment-Signature": encodePaymentHeader(paymentPayload),
        };

        setState("settling");
        setFlowState("retrying");
        const retryRes = await fetch("/api/demo/gasless", { method: "POST", headers: retryHeaders });
        setFlowState("verifying");
        setSettle(parsePaymentResponse(retryRes));
        const data = await retryRes.json();
        setTxHash(data.settlement?.txHash || null);
      }

      setState("done");
      setFlowState("done");
    } catch {
      setFlowState("error");
      setState("idle");
    }
  }, [isDemo, activeFamily, signPayment]);

  const reset = () => {
    setState("idle");
    setTxHash(null);
    setFlowState("idle");
    setSettle(null);
  };

  return (
    <div className="space-y-6">
      {/* Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Fuel size={16} className="text-[var(--color-error)]" />
            <h3 className="text-sm font-semibold">Traditional</h3>
          </div>
          <ul className="text-xs text-[var(--color-muted)] space-y-1.5">
            <li className="flex items-center gap-2"><span className="text-[var(--color-error)]">✗</span> Requires ETH for gas</li>
            <li className="flex items-center gap-2"><span className="text-[var(--color-error)]">✗</span> User needs 2 tokens</li>
            <li className="flex items-center gap-2"><span className="text-[var(--color-error)]">✗</span> Complex onboarding</li>
            <li className="flex items-center gap-2"><span className="text-[var(--color-error)]">✗</span> Gas price volatility</li>
          </ul>
        </div>
        <div className="glass-card p-5" style={{ boxShadow: "inset 0 0 0 1px #10B98133" }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} style={{ color: "var(--color-scenario-gasless)" }} />
            <h3 className="text-sm font-semibold">Gasless (ERC-4337)</h3>
          </div>
          <ul className="text-xs text-[var(--color-muted)] space-y-1.5">
            <li className="flex items-center gap-2"><span className="text-[var(--color-success)]">✓</span> No ETH needed</li>
            <li className="flex items-center gap-2"><span className="text-[var(--color-success)]">✓</span> Only USDT required</li>
            <li className="flex items-center gap-2"><span className="text-[var(--color-success)]">✓</span> One-click payment</li>
            <li className="flex items-center gap-2"><span className="text-[var(--color-success)]">✓</span> Paymaster covers gas</li>
          </ul>
        </div>
      </div>

      {flowState !== "idle" && (
        <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
      )}

      {/* Execution flow */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4">ERC-4337 Payment Flow</h3>

        {state === "idle" && (
          <button onClick={execute} className="btn-primary px-4 py-3 text-sm w-full min-h-[44px] flex items-center justify-center gap-2">
            <Zap size={14} />
            Pay 0.001 USDT (Gasless)
          </button>
        )}

        {state !== "idle" && (
          <div className="space-y-3">
            <Step
              label="1. Create UserOperation"
              status={state === "creating-userop" ? "active" : getStepStatus("creating-userop", state)}
            />
            <Step
              label="2. Submit to Bundler"
              status={state === "bundling" ? "active" : getStepStatus("bundling", state)}
            />
            <Step
              label="3. On-chain Settlement"
              status={state === "settling" ? "active" : getStepStatus("settling", state)}
            />

            {state === "done" && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-[var(--color-success)]">
                  <CheckCircle size={14} />
                  <span className="text-sm font-medium">Payment complete — no gas spent!</span>
                </div>
                {txHash && (
                  <p className="text-xs font-mono text-[var(--color-muted)]">
                    tx: {txHash.slice(0, 10)}...{txHash.slice(-6)}
                  </p>
                )}
                <button onClick={reset} className="text-xs text-[var(--color-brand)] hover:underline">
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        ERC-4337 Account Abstraction with a Paymaster sponsors gas fees. Users sign a USDT authorization — the Paymaster pays ETH gas and deducts from the USDT transfer.
      </p>
    </div>
  );
}

const STEP_ORDER: GaslessState[] = ["creating-userop", "bundling", "settling", "done"];

function getStepStatus(step: GaslessState, current: GaslessState): "pending" | "done" | "active" {
  const stepIdx = STEP_ORDER.indexOf(step);
  const currentIdx = STEP_ORDER.indexOf(current);
  if (currentIdx > stepIdx) return "done";
  return "pending";
}

function Step({ label, status }: { label: string; status: "pending" | "active" | "done" }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
        status === "done" ? "bg-[var(--color-success)] text-white" :
        status === "active" ? "bg-[var(--color-brand-dim)] text-[var(--color-brand)]" :
        "bg-[var(--color-surface)] text-[var(--color-muted)]"
      }`}>
        {status === "done" ? "✓" : status === "active" ? <Spinner /> : "○"}
      </div>
      <span className={`text-xs ${status === "active" ? "text-white" : "text-[var(--color-muted)]"}`}>
        {label}
      </span>
    </div>
  );
}
