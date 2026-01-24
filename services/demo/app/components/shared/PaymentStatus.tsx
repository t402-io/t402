"use client";

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
  requesting: "Sending request to server",
  "got-402": "Server requires payment. Preparing authorization.",
  signing: "Signing payment authorization",
  retrying: "Sending payment to server",
  verifying: "Verifying payment on-chain",
  done: "Payment settled successfully",
  error: "Payment failed",
};

/**
 * Compact payment status display: animated FlowDiagram + TransactionLink.
 * Drop this into any scenario to show real-time payment progress.
 */
export function PaymentStatus({ flowState, settle, family }: PaymentStatusProps) {
  const showResult = flowState === "done" && settle?.transaction;

  return (
    <div className="glass-card p-3 sm:p-4" aria-busy={flowState !== "idle" && flowState !== "done" && flowState !== "error"}>
      {/* Screen reader announcement for payment progress */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {FLOW_ANNOUNCEMENTS[flowState]}
      </div>
      <FlowDiagram state={flowState} compact />
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
