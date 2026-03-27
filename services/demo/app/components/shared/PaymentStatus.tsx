"use client";

import { useState, useEffect } from "react";
import { FlowDiagram } from "./FlowDiagram";
import { TransactionLink } from "./TransactionLink";
import type { FlowState } from "@/hooks/usePaymentFlow";
import type { ChainFamily } from "@/lib/testnet-config";

export interface SettleInfo {
  success?: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
}

interface PaymentStatusProps {
  /** Current flow state for the diagram */
  flowState: FlowState;
  /** Settlement response data (shown when done) */
  settle?: SettleInfo | null;
  /** Active chain family for explorer links */
  family: ChainFamily;
}

const FLOW_ANNOUNCEMENTS: Record<FlowState, string> = {
  idle: "",
  requesting: "Requesting payment requirements from server",
  "got-402": "Server requires payment. Preparing authorization.",
  "switching-chain": "Switching wallet to correct chain",
  approving: "Step 1/2: Approving token — confirm in your wallet",
  signing: "Waiting for wallet signature approval",
  retrying: "Submitting payment for verification",
  verifying: "Verifying settlement on blockchain",
  done: "Payment complete, access granted",
  error: "Payment failed",
};

/**
 * Compact payment status display: animated FlowDiagram + TransactionLink.
 * Drop this into any scenario to show real-time payment progress.
 */
export function PaymentStatus({ flowState, settle, family }: PaymentStatusProps) {
  const showResult = flowState === "done" && settle?.transaction;

  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (flowState === "requesting" && !startTime) {
      setStartTime(Date.now());
    }
    if (flowState === "done" || flowState === "error") {
      if (startTime) {
        setElapsed(Date.now() - startTime);
      }
    }
    if (flowState === "idle") {
      setStartTime(null);
      setElapsed(0);
    }
  }, [flowState, startTime]);

  // Running timer during active flow
  useEffect(() => {
    if (!startTime || flowState === "done" || flowState === "error" || flowState === "idle") return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime, flowState]);

  return (
    <div className="glass-card p-3 sm:p-4" aria-busy={flowState !== "idle" && flowState !== "done" && flowState !== "error"}>
      {/* Screen reader announcement for payment progress */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {FLOW_ANNOUNCEMENTS[flowState]}
      </div>
      <FlowDiagram state={flowState} compact />
      {flowState === "requesting" && (
        <p className="text-xs text-center mt-3" style={{ color: "var(--color-muted)" }}>
          Requesting payment requirements...
        </p>
      )}
      {flowState === "got-402" && (
        <p className="text-xs text-center mt-3" style={{ color: "var(--color-muted)" }}>
          Payment required. Preparing authorization...
        </p>
      )}
      {flowState === "switching-chain" && (
        <div className="text-center mt-3">
          <p className="text-xs font-medium" style={{ color: "var(--color-info)" }}>
            Switching wallet to the correct chain...
          </p>
          <p className="text-[10px] mt-1" style={{ color: "var(--color-muted)" }}>
            Please confirm the chain switch in your wallet
          </p>
        </div>
      )}
      {flowState === "signing" && (
        <div className="text-center mt-3">
          <p className="text-xs font-medium" style={{ color: "var(--color-warning)" }}>
            Check your wallet for a signature request
          </p>
          <p className="text-[10px] mt-1" style={{ color: "var(--color-muted)" }}>
            Approve the transaction in your wallet extension to continue
          </p>
        </div>
      )}
      {flowState === "retrying" && (
        <p className="text-xs text-center mt-3" style={{ color: "var(--color-muted)" }}>
          Submitting payment to server...
        </p>
      )}
      {flowState === "verifying" && (
        <p className="text-xs text-center mt-3" style={{ color: "var(--color-muted)" }}>
          Verifying on-chain settlement...
        </p>
      )}
      {flowState === "error" && (
        <p className="text-xs text-center mt-3" style={{ color: "var(--color-error)" }}>
          Payment failed. Please try again.
        </p>
      )}
      {flowState !== "idle" && elapsed > 0 && (
        <div className="text-center mt-2">
          <span
            className="text-xs font-mono"
            style={{ color: flowState === "done" ? "var(--color-success)" : "var(--color-muted)" }}
          >
            {flowState === "done" ? `Paid in ${(elapsed / 1000).toFixed(1)}s` : `${(elapsed / 1000).toFixed(1)}s`}
          </span>
        </div>
      )}
      {showResult && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-success)]">Settled</span>
            <TransactionLink txHash={settle!.transaction!} family={family} />
          </div>
          {settle!.payer && (
            <span className="text-xs text-[var(--color-muted)] font-mono hidden sm:inline">
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
 * Returns null if the header is missing or invalid.
 */
export function parsePaymentResponse(response: Response): SettleInfo | null {
  const header = response.headers.get("Payment-Response");
  if (!header) return null;
  try {
    // Server encodes as base64url
    const padded = header + "=".repeat((4 - (header.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
