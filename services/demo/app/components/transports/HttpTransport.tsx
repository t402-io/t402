"use client";

import { motion } from "motion/react";
import { usePaymentFlow, type FlowState } from "@/hooks/usePaymentFlow";
import { useDemoContext } from "@/providers/DemoProvider";
import { Send } from "lucide-react";

const steps = [
  "Request", "402", "Sign", "Retry", "Verify", "200 OK",
];

const stateToStep: Record<FlowState, number> = {
  idle: -1, requesting: 0, "got-402": 1, signing: 2, retrying: 3, verifying: 4, done: 5, error: -1,
};

export function HttpTransport() {
  const { isDemo } = useDemoContext();
  const flow = usePaymentFlow("/api/demo/market-data");
  const currentStep = stateToStep[flow.state];

  return (
    <div className="flex h-full flex-col p-6">
      {/* Top: Progress bar + action */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={flow.state === "idle" || flow.state === "done" || flow.state === "error" ? flow.execute : flow.reset}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors shrink-0"
        >
          <Send size={14} />
          {flow.state === "idle" ? "Send Request" : flow.state === "done" ? "Run Again" : flow.state === "error" ? "Retry" : "Running..."}
        </button>

        {/* Progress bar */}
        <div className="flex flex-1 items-center gap-1">
          {steps.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-1">
              <div
                className={`flex h-7 items-center justify-center rounded-md px-2 text-xs font-medium transition-all flex-1 ${
                  i === currentStep
                    ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30"
                    : i < currentStep
                      ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                      : "bg-[var(--color-surface)] text-[var(--color-muted)]"
                }`}
              >
                {i < currentStep ? "✓" : i + 1} {label}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-px w-2 ${i < currentStep ? "bg-[var(--color-brand)]" : "bg-[var(--color-border)]"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {flow.error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {flow.error}
        </div>
      )}

      {/* HTTP panels */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {currentStep >= 0 && (
          <HttpBlock
            title="1. Initial Request"
            badge="GET"
            badgeColor="#3B82F6"
            content={`GET /api/demo/market-data HTTP/1.1\nHost: demo.t402.io\nAccept: application/json`}
          />
        )}

        {currentStep >= 1 && flow.paymentRequired != null && (
          <HttpBlock
            title="2. Payment Required"
            badge="402"
            badgeColor="#F59E0B"
            content={JSON.stringify(flow.paymentRequired, null, 2)}
          />
        )}

        {currentStep >= 2 && (
          <HttpBlock
            title={`3. EIP-3009 Signature ${isDemo ? "(simulated)" : "(via wallet)"}`}
            badge="SIGN"
            badgeColor="#F59E0B"
            content={`// TransferWithAuthorization — off-chain, gasless\n// User signs typed data via wallet\n// No on-chain transaction at this step`}
          />
        )}

        {currentStep >= 3 && (
          <HttpBlock
            title="4. Retry with Payment"
            badge="GET"
            badgeColor="#8B5CF6"
            content={`GET /api/demo/market-data HTTP/1.1\nPayment-Signature: <base64-encoded PaymentPayload>\nAccept: application/json`}
          />
        )}

        {currentStep >= 4 && (
          <HttpBlock
            title="5. Facilitator Verify + Settle"
            badge="OK"
            badgeColor="#10B981"
            content={flow.settleResponse
              ? `POST facilitator.t402.io/verify → ✓ Valid\nPOST facilitator.t402.io/settle → ✓\n\n${JSON.stringify(flow.settleResponse, null, 2)}`
              : `POST facilitator.t402.io/verify → ✓ Valid\nPOST facilitator.t402.io/settle → Settling...`}
          />
        )}

        {currentStep >= 5 && flow.data != null && (
          <HttpBlock
            title="6. Resource Delivered"
            badge="200"
            badgeColor="#10B981"
            content={JSON.stringify(flow.data, null, 2)}
          />
        )}

        {currentStep < 0 && (
          <div className="flex h-full items-center justify-center text-[var(--color-muted)]">
            Click &quot;Send Request&quot; to start the HTTP 402 flow
          </div>
        )}
      </div>
    </div>
  );
}

function HttpBlock({ title, badge, badgeColor, content }: {
  title: string;
  badge: string;
  badgeColor: string;
  content: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-code-bg)] overflow-hidden"
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}
        >
          {badge}
        </span>
        <span className="text-sm text-white/80">{title}</span>
      </div>
      <pre className="p-4 text-[var(--text-code)] text-gray-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
        {content}
      </pre>
    </motion.div>
  );
}
