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

/**
 * Compact payment status display: animated FlowDiagram + TransactionLink.
 * Drop this into any scenario to show real-time payment progress.
 */
export function PaymentStatus({ flowState, settle, family }: PaymentStatusProps) {
  const showResult = flowState === "done" && settle?.transaction;

  return (
    <div className="glass-card p-3 sm:p-4">
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
