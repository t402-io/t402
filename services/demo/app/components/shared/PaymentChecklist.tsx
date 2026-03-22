"use client";

import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { useWalletReady } from "@/providers/ClientProviders";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { Check, X, AlertCircle } from "lucide-react";

function ChecklistInner() {
  const { activeConfig } = useChainContext();
  const { isConnected } = useMultiChainPayment();

  const checks = [
    {
      label: `Chain: ${activeConfig.label}`,
      ok: true,
    },
    {
      label: isConnected ? "Wallet connected" : "Wallet not connected",
      ok: isConnected,
      help: !isConnected ? "Click Connect Wallet in the header" : undefined,
    },
  ];

  const allReady = checks.every((c) => c.ok);
  if (allReady) return null;

  return (
    <div
      className="rounded-xl p-4 mb-6 text-xs"
      style={{
        background: "var(--color-warning-dim)",
        border: "1px solid var(--color-warning)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle size={14} style={{ color: "var(--color-warning)" }} />
        <span className="font-semibold" style={{ color: "var(--color-warning)" }}>
          Before you can pay
        </span>
      </div>
      <div className="space-y-1.5">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-2">
            {check.ok ? (
              <Check size={12} style={{ color: "var(--color-success)" }} />
            ) : (
              <X size={12} style={{ color: "var(--color-error)" }} />
            )}
            <span style={{ color: check.ok ? "var(--color-success)" : "var(--color-error)" }}>
              {check.label}
            </span>
            {check.help && (
              <span style={{ color: "var(--color-muted)" }}> — {check.help}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaymentChecklist() {
  const { isDemo } = useDemoContext();
  const walletReady = useWalletReady();

  // In demo mode or before wallet providers mount, don't show
  if (isDemo || !walletReady) return null;

  return <ChecklistInner />;
}
