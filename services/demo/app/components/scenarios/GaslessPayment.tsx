"use client";

import { useState, useCallback } from "react";
import { Zap, Fuel, CheckCircle } from "lucide-react";
import { Spinner } from "@/components/shared/Spinner";
import { useDemoContext } from "@/providers/DemoProvider";
import { useChainContext } from "@/providers/ChainProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { PaymentStatus, parsePaymentResponse, type SettleInfo } from "@/components/shared/PaymentStatus";
import { WalletChainIndicator } from "@/components/shared/WalletChainIndicator";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { encodePaymentHeader } from "@/lib/t402-client";
import { chainIdFromCaip2 } from "@/lib/evm-chains";

type GaslessState = "idle" | "creating-userop" | "bundling" | "settling" | "done" | "error";

export function GaslessPayment() {
  const { isDemo, testnet } = useDemoContext();
  const { signPayment, activeFamily, activeNetwork } = useMultiChainPayment();
  const { ensureEvmChain, isChainMatched, isSwitchingChain } = useChainContext();
  const [state, setState] = useState<GaslessState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);
  const [erc4337Data, setErc4337Data] = useState<{
    real: boolean;
    userOpHash?: string;
    txHash?: string | null;
    smartAccountAddress?: string;
    gasSponsored?: boolean;
    gasSavedEstimate?: string;
    error?: string;
  } | null>(null);

  const execute = useCallback(async () => {
    setState("creating-userop");
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

      // Chain validation gate for EVM
      if (activeFamily === "evm" && !isDemo && activeNetwork) {
        const targetChainId = chainIdFromCaip2(activeNetwork);
        if (targetChainId) {
          setFlowState("switching-chain" as FlowState);
          const switched = await ensureEvmChain(targetChainId);
          if (!switched) {
            throw new Error("Please switch your wallet to the correct chain.");
          }
        }
      }

      // Get 402 from gasless API
      const res = await fetch("/api/demo/gasless", { method: "POST", headers });
      if (res.status === 402) {
        setFlowState("got-402");
        const paymentRequired = await res.json();
        const requirements = paymentRequired.accepts?.[0];
      if (!requirements) throw new Error("No payment options available");
        setFlowState("signing");
        const paymentPayload = await signPayment(requirements, (step) => {
        if (step === "switching-chain") setFlowState("switching-chain" as FlowState);
        if (step === "approving") setFlowState("approving");
        if (step === "signing") setFlowState("signing");
      });

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
        if (data.erc4337) {
          setErc4337Data(data.erc4337);
        }
      }

      setState("done");
      setFlowState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setFlowState("error");
      setState("error");
    }
  }, [isDemo, activeFamily, activeNetwork, testnet, signPayment, ensureEvmChain]);

  const reset = () => {
    setState("idle");
    setError(null);
    setTxHash(null);
    setFlowState("idle");
    setSettle(null);
    setErc4337Data(null);
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

      <WalletChainIndicator />

      {flowState !== "idle" && (
        <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
      )}

      {/* Execution flow */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4">ERC-4337 Payment Flow</h3>

        {error && (
          <p className="text-xs text-[var(--color-error)] mb-3">{error}</p>
        )}

        {(state === "idle" || state === "error") && (
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
                {erc4337Data?.real && (
                  <div className="glass-card p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                      <span className="font-medium text-[var(--color-success)]">Real ERC-4337</span>
                      {erc4337Data.gasSponsored && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--color-success-dim)] text-[var(--color-success)]">
                          Gas Sponsored
                        </span>
                      )}
                    </div>
                    {erc4337Data.smartAccountAddress && (
                      <p className="font-mono text-[var(--color-muted)]">
                        Smart Account: {erc4337Data.smartAccountAddress.slice(0, 10)}...{erc4337Data.smartAccountAddress.slice(-6)}
                      </p>
                    )}
                    {erc4337Data.gasSavedEstimate && (
                      <p className="text-[var(--color-muted)]">Gas saved: {erc4337Data.gasSavedEstimate}</p>
                    )}
                  </div>
                )}
                {txHash && (
                  <p className="text-xs font-mono text-[var(--color-muted)]">
                    tx: {txHash.slice(0, 10)}...{txHash.slice(-6)}
                  </p>
                )}
                {!erc4337Data?.real && (
                  <p className="text-[10px] text-[var(--color-muted)]">
                    {isDemo
                      ? "Demo mode — switch to Live for real ERC-4337 gasless execution"
                      : "Simulated — configure PIMLICO_API_KEY for real ERC-4337 execution"}
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
