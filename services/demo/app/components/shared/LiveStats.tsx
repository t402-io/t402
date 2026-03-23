"use client";

import { useFacilitatorStatus } from "@/hooks/useFacilitatorStatus";
import { Activity, Globe, Shield, Layers } from "lucide-react";

export function LiveStats() {
  const { online, supportedKinds, loading } = useFacilitatorStatus();

  const items = [
    {
      icon: Globe,
      value: "44",
      label: "Networks",
      detail: "34 Mainnet + 10 Testnet",
    },
    {
      icon: Layers,
      value: loading ? "\u2014" : String(supportedKinds),
      label: "Payment Kinds",
      detail: null,
    },
    {
      icon: Shield,
      value: "13",
      label: "Mechanisms",
      detail: null,
    },
    {
      icon: Activity,
      value: "4",
      label: "SDKs",
      detail: "TS \u00B7 Go \u00B7 Python \u00B7 Java",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Facilitator status bar */}
      <div className="flex items-center justify-center gap-2 mb-5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{
            backgroundColor: loading
              ? "var(--color-text-tertiary)"
              : online
                ? "var(--color-success)"
                : "var(--color-error)",
          }}
        />
        <span
          className="text-xs font-medium"
          style={{
            color: loading
              ? "var(--color-text-tertiary)"
              : online
                ? "var(--color-success)"
                : "var(--color-error)",
          }}
        >
          {loading
            ? "Checking facilitator..."
            : online
              ? `Facilitator healthy \u00B7 ${supportedKinds} kinds`
              : "Facilitator offline"}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="text-center p-4 rounded-xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <item.icon size={16} className="mx-auto mb-2" style={{ color: "var(--color-brand)" }} aria-hidden="true" />
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {item.value}
            </div>
            <div className="text-[10px] sm:text-xs mt-1" style={{ color: "var(--color-muted)" }}>
              {item.label}
            </div>
            {item.detail && (
              <div className="text-[9px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                {item.detail}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
