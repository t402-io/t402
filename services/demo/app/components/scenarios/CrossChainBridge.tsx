"use client";

import { useState, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { ChainLogo } from "@/components/shared/ChainLogo";
import { ChainBadge } from "@/components/shared/ChainBadge";
import { Spinner } from "@/components/shared/Spinner";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { PaymentStatus, parsePaymentResponse, type SettleInfo } from "@/components/shared/PaymentStatus";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { type ChainFamily, CHAIN_CONFIGS } from "@/lib/testnet-config";
import { encodePaymentHeader } from "@/lib/t402-client";

type BridgeState = "idle" | "selecting" | "paying" | "bridging" | "confirming" | "done";

// Chains that support cross-chain bridging via LayerZero USDT0 or similar protocols
// Note: Full bridging support varies by chain - EVM chains have the best coverage
const BRIDGEABLE: ChainFamily[] = ["evm", "ton", "tron", "solana", "stacks", "near", "aptos", "tezos", "polkadot", "cosmos"];

export function CrossChainBridge() {
  const { isDemo, testnet } = useDemoContext();
  const { signPayment, activeFamily } = useMultiChainPayment();
  const [sourceChain, setSourceChain] = useState<ChainFamily>("evm");
  const [targetChain, setTargetChain] = useState<ChainFamily>("ton");
  const [state, setState] = useState<BridgeState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);

  const executeBridge = useCallback(async () => {
    setState("paying");
    setFlowState("requesting");
    setSettle(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-preferred-chain": activeFamily,
        "x-network-mode": testnet ? "testnet" : "mainnet",
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      const body = JSON.stringify({ sourceChain, targetChain, amount: "1000000" });

      // Get 402 from bridge API
      const res = await fetch("/api/demo/bridge", { method: "POST", headers, body });
      if (res.status === 402) {
        setFlowState("got-402");
        const paymentRequired = await res.json();
        const requirements = paymentRequired.accepts?.[0];
      if (!requirements) throw new Error("No payment options available");
        setFlowState("signing");
        const paymentPayload = await signPayment(requirements);

        setState("bridging");

        const retryHeaders: Record<string, string> = {
          ...headers,
          "Payment-Signature": encodePaymentHeader(paymentPayload),
        };

        setState("confirming");
        setFlowState("retrying");
        const retryRes = await fetch("/api/demo/bridge", { method: "POST", headers: retryHeaders, body });
        setFlowState("verifying");
        setSettle(parsePaymentResponse(retryRes));
        const data = await retryRes.json();
        setTxHash(data.bridge?.txHash || null);
      }
    } catch (err) {
      // Handle error - don't set fake tx hash on real errors
      console.error("Bridge error:", err);
      setFlowState("error");
      setState("idle");
      return; // Exit early on error
    }

    setState("done");
    setFlowState("done");
  }, [isDemo, activeFamily, signPayment, sourceChain, targetChain]);

  const reset = () => {
    setState("idle");
    setTxHash(null);
    setFlowState("idle");
    setSettle(null);
  };

  const availableTargets = BRIDGEABLE.filter((c) => c !== sourceChain);

  return (
    <div className="space-y-6 overflow-hidden">
      {/* Chain selection */}
      <div className="glass-card p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Source */}
          <div className="flex-1 w-full min-w-0">
            <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-2 block">Source Chain</label>
            <div className="flex flex-wrap gap-2">
              {BRIDGEABLE.map((chain) => (
                <button
                  key={chain}
                  onClick={() => {
                    setSourceChain(chain);
                    if (targetChain === chain) setTargetChain(availableTargets[0]);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all whitespace-nowrap ${
                    sourceChain === chain
                      ? "bg-[var(--color-surface-active)] text-white"
                      : "text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-surface)]"
                  }`}
                >
                  <ChainLogo family={chain} size={14} />
                  {CHAIN_CONFIGS[chain].label}
                </button>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-surface)]">
            <ArrowRight size={16} className="text-[var(--color-scenario-bridge)]" />
          </div>

          {/* Target */}
          <div className="flex-1 w-full min-w-0">
            <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-2 block">Target Chain</label>
            <div className="flex flex-wrap gap-2">
              {BRIDGEABLE.filter((c) => c !== sourceChain).map((chain) => (
                <button
                  key={chain}
                  onClick={() => setTargetChain(chain)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all whitespace-nowrap ${
                    targetChain === chain
                      ? "bg-[var(--color-surface-active)] text-white"
                      : "text-[var(--color-muted)] hover:text-white hover:bg-[var(--color-surface)]"
                  }`}
                >
                  <ChainLogo family={chain} size={14} />
                  {CHAIN_CONFIGS[chain].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {flowState !== "idle" && (
        <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
      )}

      {/* Bridge action */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ChainBadge family={sourceChain} />
            <ArrowRight size={14} className="text-[var(--color-muted)]" />
            <ChainBadge family={targetChain} />
          </div>
          <span className="text-xs text-[var(--color-muted)]">0.01 USDT bridge fee</span>
        </div>

        {state === "idle" && (
          <div className="space-y-2">
            {flowState === "error" && (
              <p className="text-xs text-[var(--color-error)]">
                Bridge failed. Please try again.
              </p>
            )}
            <button onClick={executeBridge} disabled={state !== "idle" && state !== "done"} className="btn-primary px-4 py-3 text-sm w-full min-h-[44px]">
              {flowState === "error" ? "Try Again" : "Bridge 1.00 USDT"}
            </button>
          </div>
        )}

        {state !== "idle" && state !== "done" && (
          <div className="flex items-center gap-3 py-3">
            <Spinner />
            <span className="text-sm text-[var(--color-muted)]">
              {state === "paying" && "Signing payment authorization..."}
              {state === "bridging" && "Bridging via LayerZero..."}
              {state === "confirming" && "Confirming on target chain..."}
            </span>
          </div>
        )}

        {state === "done" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--color-success)]">
              <span className="text-sm font-medium">Bridge complete!</span>
            </div>
            {txHash && (
              <p className="text-xs font-mono text-[var(--color-muted)]">
                tx: {txHash.slice(0, 10)}...{txHash.slice(-6)}
              </p>
            )}
            <button onClick={reset} className="text-xs text-[var(--color-brand)] hover:underline">
              Bridge again
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Cross-chain payments use LayerZero USDT0 OFT standard. Pay on any chain, receive on any other — the facilitator handles bridging automatically.
      </p>
    </div>
  );
}
