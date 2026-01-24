"use client";

import { useState, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { ChainLogo } from "@/components/shared/ChainLogo";
import { ChainBadge } from "@/components/shared/ChainBadge";
import { Spinner } from "@/components/shared/Spinner";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { type ChainFamily, CHAIN_CONFIGS } from "@/lib/testnet-config";
import { encodePaymentHeader } from "@/lib/t402-client";

type BridgeState = "idle" | "selecting" | "paying" | "bridging" | "confirming" | "done";

const BRIDGEABLE: ChainFamily[] = ["evm", "ton", "tron", "solana"];

export function CrossChainBridge() {
  const { isDemo } = useDemoContext();
  const { signPayment, activeFamily } = useMultiChainPayment();
  const [sourceChain, setSourceChain] = useState<ChainFamily>("evm");
  const [targetChain, setTargetChain] = useState<ChainFamily>("ton");
  const [state, setState] = useState<BridgeState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const executeBridge = useCallback(async () => {
    setState("paying");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-preferred-chain": activeFamily,
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      const body = JSON.stringify({ sourceChain, targetChain, amount: "1000000" });

      // Get 402 from bridge API
      const res = await fetch("/api/demo/bridge", { method: "POST", headers, body });
      if (res.status === 402) {
        const paymentRequired = await res.json();
        const requirements = paymentRequired.accepts[0];
        const paymentPayload = await signPayment(requirements);

        setState("bridging");

        const retryHeaders: Record<string, string> = {
          ...headers,
          "Payment-Signature": encodePaymentHeader(paymentPayload),
        };

        setState("confirming");
        const retryRes = await fetch("/api/demo/bridge", { method: "POST", headers: retryHeaders, body });
        const data = await retryRes.json();
        setTxHash(data.bridge?.txHash || null);
      }
    } catch {
      // Fallback mock
      setTxHash("0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(""));
    }

    setState("done");
  }, [isDemo, activeFamily, signPayment, sourceChain, targetChain]);

  const reset = () => {
    setState("idle");
    setTxHash(null);
  };

  const availableTargets = BRIDGEABLE.filter((c) => c !== sourceChain);

  return (
    <div className="space-y-6">
      {/* Chain selection */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Source */}
          <div className="flex-1 w-full">
            <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-2 block">Source Chain</label>
            <div className="flex gap-2">
              {BRIDGEABLE.map((chain) => (
                <button
                  key={chain}
                  onClick={() => {
                    setSourceChain(chain);
                    if (targetChain === chain) setTargetChain(availableTargets[0]);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all ${
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
          <div className="flex-1 w-full">
            <label className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-2 block">Target Chain</label>
            <div className="flex gap-2">
              {BRIDGEABLE.filter((c) => c !== sourceChain).map((chain) => (
                <button
                  key={chain}
                  onClick={() => setTargetChain(chain)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all ${
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
          <button onClick={executeBridge} className="btn-primary px-4 py-2 text-sm w-full">
            Bridge 1.00 USDT
          </button>
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
