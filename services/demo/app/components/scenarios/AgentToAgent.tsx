"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { useDemoContext } from "@/providers/DemoProvider";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { Spinner } from "@/components/shared/Spinner";

type State = "idle" | "delegating" | "paying" | "executing" | "done" | "error";

interface A2AResult {
  id: string;
  status: { state: string };
  artifacts: Array<{
    kind: string;
    parts: Array<{ kind: string; text: string }>;
  }>;
}

const AGENT_TASKS = [
  { id: "research", label: "Research Agent", description: "Analyze market trends for BTC", icon: "🔍" },
  { id: "summary", label: "Summary Agent", description: "Summarize recent DeFi developments", icon: "📝" },
  { id: "monitor", label: "Monitor Agent", description: "Check protocol health metrics", icon: "📡" },
];

export function AgentToAgent() {
  const { isDemo } = useDemoContext();
  const [selectedTask, setSelectedTask] = useState(AGENT_TASKS[0]);
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<A2AResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setState("delegating");
    setResult(null);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
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

      const paymentRequired = await initialResponse.json();
      const requirements = paymentRequired.accepts[0];

      await new Promise((r) => setTimeout(r, 400));

      // Step 2: Auto-pay (agent signs autonomously)
      const paymentPayload = {
        t402Version: 2,
        scheme: "exact",
        network: requirements.network,
        payload: {
          authorization: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
            to: requirements.payTo,
            value: requirements.amount,
            validAfter: 0,
            validBefore: Math.floor(Date.now() / 1000) + 60,
            nonce: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
          },
          signature: "0x" + Array.from({ length: 130 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        },
      };

      setState("executing");

      const retryHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Payment-Signature": btoa(JSON.stringify(paymentPayload)),
      };
      if (isDemo) retryHeaders["x-demo-mode"] = "true";

      const retryResponse = await fetch("/api/demo/a2a-task", {
        method: "POST",
        headers: retryHeaders,
        body: JSON.stringify({ task: selectedTask.id }),
      });

      if (!retryResponse.ok) {
        throw new Error(`Request failed: ${retryResponse.status}`);
      }

      const data = await retryResponse.json();
      setResult(data);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [isDemo, selectedTask]);

  const getStepStatus = (step: number) => {
    const stateOrder: State[] = ["idle", "delegating", "paying", "executing", "done"];
    const currentIndex = stateOrder.indexOf(state);
    if (state === "error") return "error";
    if (step < currentIndex) return "complete";
    if (step === currentIndex) return "active";
    return "pending";
  };

  return (
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
                <span className="text-xl">{task.icon}</span>
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
          onClick={state === "done" || state === "error" ? () => { setState("idle"); setResult(null); } : execute}
          disabled={state !== "idle" && state !== "done" && state !== "error"}
          className="w-full py-3 rounded-xl bg-[var(--color-brand)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
          {state === "done" || state === "error" ? "Run Again" : "Delegate Task"}
        </button>
      </div>

      {/* Right: Result */}
      <div>
        {state === "idle" && (
          <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[340px] text-center">
            <div className="text-4xl mb-3">🤝</div>
            <h4 className="text-sm font-medium mb-2">Agent-to-Agent Protocol</h4>
            <p className="text-xs text-[var(--color-muted)] max-w-xs">
              Agents autonomously pay each other for tasks using T402. No human intervention — the requesting agent signs USDT authorization automatically.
            </p>
          </div>
        )}

        {(state === "delegating" || state === "paying" || state === "executing") && (
          <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[340px]">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="text-4xl"
              >
                ⚙️
              </motion.div>
            </div>
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
              {result.artifacts?.[0]?.parts?.[0]?.text && (
                <p className="text-sm leading-relaxed">{result.artifacts[0].parts[0].text}</p>
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
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
