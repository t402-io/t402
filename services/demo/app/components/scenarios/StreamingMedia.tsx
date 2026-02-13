"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Pause, Square } from "lucide-react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { PaymentStatus, parsePaymentResponse, type SettleInfo } from "@/components/shared/PaymentStatus";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { CostTicker } from "@/components/shared/CostTicker";
import { encodePaymentHeader } from "@/lib/t402-client";

type StreamState = "idle" | "buffering" | "playing" | "paused" | "ended";

export function StreamingMedia() {
  const { isDemo } = useDemoContext();
  const { signPayment, activeFamily } = useMultiChainPayment();
  const [state, setState] = useState<StreamState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);

  const COST_PER_10S = 0.001;

  const startStream = useCallback(async () => {
    setState("buffering");
    setFlowState("requesting");
    setSettle(null);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "x-preferred-chain": activeFamily,
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      const res = await fetch("/api/demo/stream", { headers });
      if (res.status === 402) {
        setFlowState("got-402");
        const paymentRequired = await res.json();
        const requirements = paymentRequired.accepts[0];
        setFlowState("signing");
        const paymentPayload = await signPayment(requirements);

        const retryHeaders: Record<string, string> = {
          ...headers,
          "Payment-Signature": encodePaymentHeader(paymentPayload),
        };
        setFlowState("retrying");
        const retryRes = await fetch("/api/demo/stream?segment=0", { headers: retryHeaders });
        setFlowState("verifying");
        setSettle(parsePaymentResponse(retryRes));
      }

      setTotalCost(COST_PER_10S);
      setState("playing");
      setFlowState("done");
    } catch {
      setState("idle");
      setFlowState("error");
    }
  }, [isDemo, activeFamily, signPayment]);

  useEffect(() => {
    if (state === "playing") {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          // Charge every 10 seconds
          if (next % 10 === 0) {
            setTotalCost((c) => c + COST_PER_10S);
          }
          return next;
        });
        // Generate waveform
        setWaveform((prev) => [...prev.slice(-60), Math.random() * 0.8 + 0.2]);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state]);

  const togglePause = () => {
    setState(state === "playing" ? "paused" : "playing");
  };

  const stop = () => {
    setState("ended");
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const reset = () => {
    setState("idle");
    setElapsed(0);
    setTotalCost(0);
    setWaveform([]);
    setFlowState("idle");
    setSettle(null);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {/* Player */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Premium Audio Stream</h3>
            <p className="text-xs text-[var(--color-muted)]">Pay-per-second • upto scheme</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(80, 175, 149, 0.12)", color: "#50AF95" }}>
            {COST_PER_10S} USDT/10s
          </span>
        </div>

        {/* Waveform visualization */}
        <div className="h-16 flex items-center gap-[2px] mb-4 bg-[var(--color-code-bg)] rounded-lg px-3 overflow-hidden">
          {state === "idle" ? (
            <p className="text-xs text-[var(--color-muted)] mx-auto">Click play to start streaming</p>
          ) : (
            waveform.map((h, i) => (
              <div
                key={i}
                className="w-1 rounded-full transition-all duration-100"
                style={{
                  height: `${h * 100}%`,
                  background: state === "paused"
                    ? "var(--color-muted)"
                    : "var(--color-scenario-stream)",
                  opacity: state === "paused" ? 0.4 : 1,
                }}
              />
            ))
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {state === "idle" || state === "ended" ? (
              <button
                onClick={state === "ended" ? reset : startStream}
                className="btn-primary w-11 h-11 flex items-center justify-center rounded-full"
                aria-label={state === "ended" ? "Replay" : "Play"}
              >
                <Play size={18} />
              </button>
            ) : (
              <>
                <button
                  onClick={togglePause}
                  className="w-11 h-11 flex items-center justify-center rounded-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors"
                  aria-label={state === "playing" ? "Pause" : "Play"}
                >
                  {state === "playing" ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  onClick={stop}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <Square size={14} />
                </button>
              </>
            )}
            <span className="text-sm font-mono text-[var(--color-muted)]">{formatTime(elapsed)}</span>
          </div>
          {totalCost > 0 && <CostTicker totalCost={totalCost} />}
        </div>
      </div>

      {flowState !== "idle" && (
        <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
      )}

      {/* Info */}
      <div className="text-xs text-[var(--color-muted)] space-y-1">
        <p>Uses the <strong>upto</strong> scheme — client authorizes a maximum amount, server charges only actual usage.</p>
        <p>Each 10-second segment costs {COST_PER_10S} USDT, charged incrementally as you listen.</p>
      </div>
    </div>
  );
}
