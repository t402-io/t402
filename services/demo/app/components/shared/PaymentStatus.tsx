"use client";

import { useState, useEffect } from "react";
import { TransactionLink } from "./TransactionLink";
import type { FlowState } from "@/hooks/usePaymentFlow";
import type { ChainFamily } from "@/lib/testnet-config";
import {
  Send, ShieldAlert, PenTool, RotateCw,
  CheckCircle, Unlock, Loader2, ArrowRightLeft,
} from "lucide-react";

export interface SettleInfo {
  success?: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
}

interface PaymentStatusProps {
  flowState: FlowState;
  settle?: SettleInfo | null;
  family: ChainFamily;
}

// ─── Step definitions ───

const STEPS = [
  { id: "request", label: "Request", icon: Send },
  { id: "402", label: "402", icon: ShieldAlert },
  { id: "sign", label: "Sign", icon: PenTool },
  { id: "retry", label: "Retry", icon: RotateCw },
  { id: "settle", label: "Settle", icon: CheckCircle },
  { id: "access", label: "Access", icon: Unlock },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function flowStateToStep(state: FlowState): StepId | null {
  switch (state) {
    case "requesting": return "request";
    case "got-402": return "402";
    case "switching-chain": return "sign";
    case "approving": return "sign";
    case "signing": return "sign";
    case "retrying": return "retry";
    case "verifying": return "settle";
    case "done": return "access";
    default: return null;
  }
}

const FLOW_MESSAGES: Record<FlowState, string> = {
  idle: "",
  requesting: "Requesting payment requirements...",
  "got-402": "Payment required — preparing authorization",
  "switching-chain": "Switching wallet to correct chain...",
  approving: "Approving token — confirm in wallet",
  signing: "Waiting for wallet signature...",
  retrying: "Submitting payment to server...",
  verifying: "Verifying on-chain settlement...",
  done: "Payment complete — access granted",
  error: "Payment failed",
};

export function PaymentStatus({ flowState, settle, family }: PaymentStatusProps) {
  const showResult = flowState === "done" && settle?.transaction;
  const isError = flowState === "error";
  const isActive = flowState !== "idle" && flowState !== "done" && flowState !== "error";

  const activeStep = flowStateToStep(flowState);
  const activeIndex = activeStep ? STEPS.findIndex((s) => s.id === activeStep) : -1;

  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (flowState === "requesting" && !startTime) setStartTime(Date.now());
    if (flowState === "done" || flowState === "error") {
      if (startTime) setElapsed(Date.now() - startTime);
    }
    if (flowState === "idle") { setStartTime(null); setElapsed(0); }
  }, [flowState, startTime]);

  useEffect(() => {
    if (!startTime || flowState === "done" || flowState === "error" || flowState === "idle") return;
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(interval);
  }, [startTime, flowState]);

  return (
    <div
      className={`glass-card p-4 sm:p-5 ${isError ? "card-error" : ""} ${flowState === "done" ? "card-success" : ""}`}
      aria-busy={isActive}
    >
      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {FLOW_MESSAGES[flowState]}
      </div>

      {/* ─── Horizontal Stepper ─── */}
      <div className="flex items-center justify-between mb-4">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isCompleted = i < activeIndex;
          const isCurrent = i === activeIndex;
          const isFuture = i > activeIndex || activeIndex === -1;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCurrent ? "animate-glow-pulse" : ""
                  }`}
                  style={{
                    background: isCompleted ? "var(--color-success)"
                      : isCurrent ? "var(--color-brand)"
                      : "var(--color-surface)",
                    border: isCompleted ? "2px solid var(--color-success)"
                      : isCurrent ? "2px solid var(--color-brand)"
                      : "2px solid var(--color-border)",
                    boxShadow: isCurrent ? "0 0 12px rgba(80, 175, 149, 0.3)" : "none",
                  }}
                >
                  {isCompleted ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" strokeDasharray="24" className="animate-draw-check" />
                    </svg>
                  ) : isCurrent ? (
                    isActive ? <Loader2 size={14} className="animate-spin text-white" /> : <Icon size={14} className="text-white" />
                  ) : (
                    <Icon size={14} style={{ color: "var(--color-text-tertiary)" }} />
                  )}
                </div>
                <span
                  className="text-[9px] sm:text-[10px] font-medium"
                  style={{
                    color: isCompleted ? "var(--color-success)"
                      : isCurrent ? "var(--color-text-primary)"
                      : "var(--color-text-tertiary)",
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting line */}
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-[2px] mx-1.5 sm:mx-2 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: isCompleted ? "100%" : isCurrent ? "50%" : "0%",
                      background: isCompleted ? "var(--color-success)" : "var(--color-brand)",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Status Message ─── */}
      {flowState !== "idle" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isActive && (
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--color-brand)" }} />
            )}
            {flowState === "done" && (
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-success)" }} />
            )}
            {isError && (
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-error)" }} />
            )}
            <p
              className="text-xs sm:text-sm font-medium"
              style={{
                color: flowState === "done" ? "var(--color-success)"
                  : isError ? "var(--color-error)"
                  : "var(--color-text-secondary)",
              }}
            >
              {FLOW_MESSAGES[flowState]}
            </p>
          </div>
          {elapsed > 0 && (
            <span
              className="text-xs font-mono tabular-nums"
              style={{ color: flowState === "done" ? "var(--color-success)" : "var(--color-text-tertiary)" }}
            >
              {flowState === "done" ? `${(elapsed / 1000).toFixed(1)}s` : `${(elapsed / 1000).toFixed(1)}s`}
            </span>
          )}
        </div>
      )}

      {/* ─── Transaction Result ─── */}
      {showResult && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={12} style={{ color: "var(--color-success)" }} />
            <TransactionLink txHash={settle!.transaction!} family={family} />
          </div>
          {settle!.payer && (
            <span className="text-[10px] sm:text-xs text-[var(--color-muted)] font-mono">
              {settle!.payer.slice(0, 6)}...{settle!.payer.slice(-4)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Parse the Payment-Response header from a fetch Response.
 */
export function parsePaymentResponse(response: Response): SettleInfo | null {
  const header = response.headers.get("Payment-Response");
  if (!header) return null;
  try {
    const padded = header + "=".repeat((4 - (header.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
