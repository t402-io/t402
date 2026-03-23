"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { PaymentStatus, parsePaymentResponse, type SettleInfo } from "@/components/shared/PaymentStatus";
import type { FlowState } from "@/hooks/usePaymentFlow";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { Spinner } from "@/components/shared/Spinner";
import { encodePaymentHeader } from "@/lib/t402-client";
import { Search, FileText, Radio, Handshake, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type State = "idle" | "delegating" | "paying" | "executing" | "done" | "error";

interface A2AResult {
  id: string;
  type: string;
  status: string;
  result: {
    summary: string;
    details: string[];
  };
  [key: string]: unknown;
}

const AGENT_TASKS: { id: string; label: string; description: string; icon: LucideIcon }[] = [
  { id: "research", label: "Research Agent", description: "Analyze market trends for BTC", icon: Search },
  { id: "summary", label: "Summary Agent", description: "Summarize recent DeFi developments", icon: FileText },
  { id: "monitor", label: "Monitor Agent", description: "Check protocol health metrics", icon: Radio },
];

export function AgentToAgent() {
  const { isDemo } = useDemoContext();
  const { signPayment, activeFamily } = useMultiChainPayment();
  const [selectedTask, setSelectedTask] = useState(AGENT_TASKS[0]);
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<A2AResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [settle, setSettle] = useState<SettleInfo | null>(null);

  const execute = useCallback(async () => {
    setState("delegating");
    setResult(null);
    setError(null);
    setFlowState("requesting");
    setSettle(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-preferred-chain": activeFamily,
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      // Step 1: Send A2A task (gets 402)
      await new Promise((r) => setTimeout(r, 600));
      setState("paying");

      const initialResponse = await fetch("/api/demo/a2a-task", {
        method: "POST",
        headers,
        body: JSON.stringify({ task: selectedTask.id }),
      });

      if (initialResponse.status !== 402) {
        throw new Error(`Unexpected status: ${initialResponse.status}`);
      }

      setFlowState("got-402");
      const paymentRequired = await initialResponse.json();
      const requirements = paymentRequired.accepts?.[0];
      if (!requirements) throw new Error("No payment options available");

      // Step 2: Auto-pay (agent signs autonomously via multi-chain hook)
      setFlowState("signing");
      const paymentPayload = await signPayment(requirements);

      setState("executing");

      const retryHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "x-preferred-chain": activeFamily,
        "Payment-Signature": encodePaymentHeader(paymentPayload),
      };
      if (isDemo) retryHeaders["x-demo-mode"] = "true";

      setFlowState("retrying");
      const retryResponse = await fetch("/api/demo/a2a-task", {
        method: "POST",
        headers: retryHeaders,
        body: JSON.stringify({ task: selectedTask.id }),
      });

      setFlowState("verifying");
      setSettle(parsePaymentResponse(retryResponse));

      if (!retryResponse.ok) {
        const errBody = await retryResponse.json().catch(() => null);
        const reason = errBody?.reason || errBody?.error || `status ${retryResponse.status}`;
        throw new Error(reason);
      }

      const data = await retryResponse.json();
      setResult(data);
      setState("done");
      setFlowState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      setFlowState("error");
    }
  }, [isDemo, activeFamily, signPayment, selectedTask]);

  const getStepStatus = (step: number) => {
    const stateOrder: State[] = ["idle", "delegating", "paying", "executing", "done"];
    const currentIndex = stateOrder.indexOf(state);
    if (state === "error") return "error";
    if (step < currentIndex) return "complete";
    if (step === currentIndex) return "active";
    return "pending";
  };

  return (
    <>
    {flowState !== "idle" && (
      <PaymentStatus flowState={flowState} settle={settle} family={activeFamily} />
    )}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Agent selection + flow */}
      <div className="flex flex-col gap-4">
        <div className="glass-card p-5">
          <h4 className="text-sm font-medium mb-3">Delegate Task to Agent</h4>
          <div className="space-y-2">
            {AGENT_TASKS.map((task) => (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                disabled={state !== "idle" && state !== "done" && state !== "error"}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedTask.id === task.id
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-dim)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-muted)]"
                }`}
              >
                <task.icon size={18} style={{ color: "var(--color-scenario-agent)" }} />
                <div className="text-left">
                  <p className="text-sm font-medium">{task.label}</p>
                  <p className="text-xs text-[var(--color-muted)]">{task.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* A2A Flow Steps */}
        <div className="glass-card p-4">
          <div className="space-y-3">
            {["Agent A delegates task", "Agent B returns 402", "Agent A auto-pays USDT", "Agent B executes & returns result"].map((step, i) => {
              const status = getStepStatus(i + 1);
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    status === "complete" ? "bg-[var(--color-brand)] text-white" :
                    status === "active" ? "bg-[var(--color-brand)] text-white animate-pulse" :
                    "bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]"
                  }`}>
                    {status === "complete" ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs ${
                    status === "complete" || status === "active" ? "text-white" : "text-[var(--color-muted)]"
                  }`}>
                    {step}
                  </span>
                  {status === "active" && <Spinner size="sm" color="var(--color-brand)" />}
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={state === "done" || state === "error" ? () => { setState("idle"); setResult(null); setFlowState("idle"); setSettle(null); } : execute}
          disabled={state !== "idle" && state !== "done" && state !== "error"}
          className="btn-primary w-full py-3 min-h-[44px]"
        >
          {state === "done" || state === "error" ? "Run Again" : "Delegate Task"}
        </button>
      </div>

      {/* Right: Result */}
      <div>
        {state === "idle" && (
          <div className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center min-h-[280px] sm:min-h-[340px] text-center">
            <Handshake size={32} className="mb-3" style={{ color: "var(--color-scenario-agent)" }} />
            <h4 className="text-sm font-medium mb-2">Agent-to-Agent Protocol</h4>
            <p className="text-xs text-[var(--color-muted)] max-w-xs">
              Agents autonomously pay each other for tasks using T402. No human intervention — the requesting agent signs USDT authorization automatically.
            </p>
          </div>
        )}

        {(state === "delegating" || state === "paying" || state === "executing") && (
          <div className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center min-h-[280px] sm:min-h-[340px]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Settings size={32} style={{ color: "var(--color-scenario-agent)" }} />
            </motion.div>
            <p className="text-sm mt-4 font-medium">
              {state === "delegating" && "Agent A delegating task..."}
              {state === "paying" && "Agent A paying Agent B..."}
              {state === "executing" && "Agent B executing task..."}
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              {state === "paying" && "Auto-signing 0.001 USDT authorization"}
              {state === "executing" && "Processing with paid compute"}
            </p>
          </div>
        )}

        {state === "done" && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-success-dim)] text-[var(--color-success)]">
                  Task Complete
                </span>
                <span className="text-xs text-[var(--color-muted)]">0.001 USDT paid</span>
              </div>
              {result.result?.summary && (
                <p className="text-sm leading-relaxed">{result.result.summary}</p>
              )}
            </div>
            <CodeBlock
              code={JSON.stringify(result, null, 2)}
              language="json"
              label="A2A Task Response"
              labelColor="var(--color-brand)"
              showCopyButton
              maxHeight="200px"
            />
          </motion.div>
        )}

        {state === "error" && (
          <div className="glass-card p-4 sm:p-6 text-center">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
