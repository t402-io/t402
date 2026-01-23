"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useEvmPayment } from "@/hooks/useEvmPayment";
import { Play } from "lucide-react";

type TaskState = "idle" | "submitted" | "payment-required" | "paying" | "working" | "completed" | "error";

const taskOptions = [
  { id: "research", label: "Deep Research", cost: "$0.001", agent: "Research Agent" },
  { id: "translate", label: "Translate Document", cost: "$0.001", agent: "Translation Agent" },
  { id: "image", label: "Generate Image", cost: "$0.001", agent: "Art Generator Agent" },
];

export function A2aTransport() {
  const { isDemo } = useDemoContext();
  const { signPayment, isConnected } = useEvmPayment();
  const [state, setState] = useState<TaskState>("idle");
  const [selectedTask, setSelectedTask] = useState(0);
  const [taskLog, setTaskLog] = useState<Array<{ state: string; data: unknown }>>([]);
  const [error, setError] = useState<string | null>(null);

  const runFlow = useCallback(async () => {
    setTaskLog([]);
    setState("idle");
    setError(null);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isDemo) headers["x-demo-mode"] = "true";

    setState("submitted");
    const submitBody = {
      jsonrpc: "2.0", id: "req-001", method: "tasks/send",
      params: { message: { kind: "message", role: "user", parts: [{ kind: "text", text: `Please ${taskOptions[selectedTask].label.toLowerCase()} about Bitcoin adoption.` }] } },
    };

    const submitRes = await fetch("/api/demo/a2a-task", { method: "POST", headers, body: JSON.stringify(submitBody) });
    const submitResult = await submitRes.json();
    setTaskLog((prev) => [...prev, { state: "submitted", data: submitBody }]);
    await delay(400);

    setState("payment-required");
    setTaskLog((prev) => [...prev, { state: "input-required", data: submitResult }]);
    await delay(600);

    setState("paying");
    let paymentPayload: unknown;
    if (isDemo) {
      await delay(800);
      paymentPayload = { t402Version: 2, scheme: "exact", network: "eip155:84532", payload: { authorization: { from: "0x742d...bD68" }, signature: "0xdemo..." } };
    } else if (isConnected) {
      const requirements = (submitResult as { result?: { status?: { message?: { metadata?: Record<string, { accepts?: Array<Record<string, unknown>> }> } } } })?.result?.status?.message?.metadata?.["t402.payment.required"]?.accepts?.[0];
      if (requirements) {
        try { paymentPayload = await signPayment(requirements as unknown as Parameters<typeof signPayment>[0]); }
        catch (err) { setError(err instanceof Error ? err.message : String(err)); setState("error"); return; }
      }
    } else { setError("Wallet not connected"); setState("error"); return; }

    const payBody = {
      jsonrpc: "2.0", id: "req-002", method: "tasks/send",
      params: { taskId: (submitResult as { result?: { id?: string } })?.result?.id, message: { kind: "message", role: "user", parts: [{ kind: "text", text: "Payment attached." }], metadata: { "t402.payment.payload": paymentPayload } } },
    };
    setTaskLog((prev) => [...prev, { state: "payment-sent", data: payBody }]);
    setState("working");

    const payRes = await fetch("/api/demo/a2a-task", { method: "POST", headers, body: JSON.stringify(payBody) });
    const payResult = await payRes.json();
    await delay(300);

    setState("completed");
    setTaskLog((prev) => [...prev, { state: "completed", data: payResult }]);
  }, [selectedTask, isDemo, isConnected, signPayment]);

  const stateLabels: Record<TaskState, string> = {
    idle: "", submitted: "Task Submitted", "payment-required": "Payment Required",
    paying: "Signing Payment", working: "Processing", completed: "Complete", error: "Error",
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Top: Task selector + action */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-2">
          {taskOptions.map((t, i) => (
            <button
              key={t.id}
              onClick={() => state === "idle" && setSelectedTask(i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                selectedTask === i
                  ? "bg-pink-600/20 text-pink-400 ring-1 ring-pink-500/30"
                  : "text-[var(--color-muted)] hover:text-white"
              }`}
            >
              {t.label} ({t.cost})
            </button>
          ))}
        </div>
        <button
          onClick={runFlow}
          disabled={state !== "idle" && state !== "completed" && state !== "error"}
          className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-500 transition-colors ml-auto disabled:opacity-50"
        >
          <Play size={14} />
          {state === "idle" ? "Send Task" : state === "completed" ? "Run Again" : state === "error" ? "Retry" : "Running..."}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {/* Agent visualization */}
      <div className="flex-1 border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-code-bg)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white">Client Agent</span>
          </div>
          {state !== "idle" && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              state === "completed" ? "bg-green-500/20 text-green-400"
                : state === "error" ? "bg-red-500/20 text-red-400"
                  : "bg-amber-500/20 text-amber-400"
            }`}>
              {stateLabels[state]}
            </span>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white">{taskOptions[selectedTask].agent}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: "calc(100% - 36px)" }}>
          {taskLog.length === 0 && (
            <div className="flex h-48 items-center justify-center text-sm text-[var(--color-muted)]">
              Select a task and click &quot;Send Task&quot;
            </div>
          )}
          {taskLog.map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-lg border p-3 ${
                entry.state === "input-required" ? "border-amber-500/30 bg-amber-500/5"
                  : entry.state === "completed" ? "border-green-500/30 bg-green-500/5"
                    : "border-[var(--color-border)] bg-white/[0.02]"
              }`}
            >
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium mb-1.5 ${
                entry.state === "completed" ? "bg-green-500/20 text-green-400"
                  : entry.state === "input-required" ? "bg-amber-500/20 text-amber-400"
                    : "bg-white/5 text-white/50"
              }`}>
                {entry.state}
              </span>
              <pre className="max-h-[100px] overflow-y-auto font-mono text-[11px] text-gray-400 leading-relaxed">
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
