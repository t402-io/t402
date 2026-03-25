"use client";

import { useState, useCallback } from "react";
import { Play, Check, ArrowRight } from "lucide-react";

type Step = "idle" | "requesting" | "got-402" | "signing" | "retrying" | "done";

export function InlineDemo() {
  const [step, setStep] = useState<Step>("idle");
  const [elapsed, setElapsed] = useState(0);

  const run = useCallback(async () => {
    setStep("requesting");
    const start = Date.now();

    try {
      const res1 = await fetch("/api/demo/content", {
        headers: { Accept: "application/json", "x-demo-mode": "true", "x-preferred-chain": "evm" },
      });
      if (res1.status !== 402) {
        setStep("idle");
        return;
      }
      const paymentRequired = await res1.json();
      setStep("got-402");

      await new Promise((r) => setTimeout(r, 600));
      setStep("signing");

      const mockPayload = btoa(JSON.stringify({
        t402Version: 2,
        scheme: "exact",
        network: paymentRequired.accepts?.[0]?.network ?? "eip155:84532",
        payload: {
          authorization: { from: "0xdemo", to: paymentRequired.accepts?.[0]?.payTo ?? "0x", value: paymentRequired.accepts?.[0]?.amount ?? "10000" },
          signature: "0xdemo",
        },
      })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

      await new Promise((r) => setTimeout(r, 400));
      setStep("retrying");

      const res2 = await fetch("/api/demo/content", {
        headers: { Accept: "application/json", "x-demo-mode": "true", "x-preferred-chain": "evm", "Payment-Signature": mockPayload },
      });
      await res2.json();
      setElapsed(Date.now() - start);
      setStep("done");
    } catch {
      setStep("idle");
    }
  }, []);

  const steps = [
    { id: "requesting" as const, label: "GET /api/demo/content", detail: "Request resource" },
    { id: "got-402" as const, label: "HTTP 402", detail: "Payment Required (10 chains)" },
    { id: "signing" as const, label: "Sign payment", detail: "EIP-712 authorization" },
    { id: "retrying" as const, label: "Retry with Payment-Signature", detail: "Send signed payment" },
    { id: "done" as const, label: "HTTP 200", detail: "Access granted" },
  ];

  const stepOrder: Step[] = ["requesting", "got-402", "signing", "retrying", "done"];
  const currentIndex = stepOrder.indexOf(step);

  if (step === "idle") {
    return (
      <button
        onClick={run}
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[44px]"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-hover)", color: "var(--color-text-primary)" }}
      >
        <Play size={14} style={{ color: "var(--color-brand)" }} />
        See a live 402 handshake
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl p-4 sm:p-5 text-left max-w-md w-full"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="space-y-2.5">
        {steps.map((s, i) => {
          const isActive = s.id === step;
          const isDone = currentIndex > i;
          return (
            <div key={s.id} className="flex items-start gap-2.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-300"
                style={{
                  background: isDone ? "var(--color-success)" : isActive ? "var(--color-brand)" : "var(--color-surface-active)",
                }}
              >
                {isDone ? (
                  <Check size={10} className="text-white" />
                ) : isActive ? (
                  <ArrowRight size={10} className="text-white" />
                ) : (
                  <span className="text-[8px]" style={{ color: "var(--color-text-tertiary)" }}>{i + 1}</span>
                )}
              </div>
              <div>
                <span
                  className={`text-xs font-mono ${isDone || isActive ? "text-white" : ""}`}
                  style={!isDone && !isActive ? { color: "var(--color-text-tertiary)" } : undefined}
                >
                  {s.label}
                </span>
                {(isDone || isActive) && (
                  <span className="text-[10px] ml-2" style={{ color: "var(--color-muted)" }}>{s.detail}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {step === "done" && (
        <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--color-border)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--color-success)" }}>
            Paid in {(elapsed / 1000).toFixed(1)}s
          </span>
          <button onClick={() => setStep("idle")} className="text-[10px]" style={{ color: "var(--color-muted)" }}>
            Run again
          </button>
        </div>
      )}
    </div>
  );
}
