"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useEvmPayment } from "@/hooks/useEvmPayment";
import { Wrench } from "lucide-react";

const toolOptions = [
  { name: "financial_analysis", label: "Financial Analysis", cost: "$0.001" },
  { name: "image_generation", label: "Image Generation", cost: "$0.001" },
  { name: "code_review", label: "Code Review", cost: "$0.001" },
];

interface Message {
  id: number;
  role: "user" | "agent" | "system";
  text: string;
  type?: "normal" | "payment" | "success";
  json?: unknown;
}

export function McpTransport() {
  const { isDemo } = useDemoContext();
  const { signPayment, isConnected } = useEvmPayment();
  const [messages, setMessages] = useState<Message[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedTool, setSelectedTool] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const addMsg = useCallback((msg: Omit<Message, "id">) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...msg, id }]);
  }, []);

  const runDemo = useCallback(async () => {
    const tool = toolOptions[selectedTool];
    setMessages([]);
    setRunning(true);
    nextId.current = 0;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isDemo) headers["x-demo-mode"] = "true";

    await delay(300);
    addMsg({ role: "user", text: `Use ${tool.label.toLowerCase()} to analyze BTC` });

    await delay(600);
    addMsg({ role: "agent", text: `Calling \`${tool.name}\` tool...` });

    const toolCallBody = {
      jsonrpc: "2.0", id: 1,
      method: "tools/call",
      params: { name: tool.name, arguments: { symbol: "BTC", timeframe: "1d" } },
    };

    await delay(400);
    addMsg({ role: "system", text: "→ tools/call", json: toolCallBody });

    const response = await fetch("/api/demo/mcp-tool", { method: "POST", headers, body: JSON.stringify(toolCallBody) });
    const errorResult = await response.json();

    await delay(300);
    addMsg({ role: "system", text: `Payment required: ${tool.cost} USDT`, type: "payment", json: errorResult });

    await delay(500);
    addMsg({ role: "agent", text: "Signing payment authorization..." });

    let paymentPayload: unknown;
    if (isDemo) {
      await delay(600);
      paymentPayload = { t402Version: 2, scheme: "exact", network: "eip155:84532", payload: { authorization: { from: "0x742d...bD68" }, signature: "0xdemo..." } };
    } else if (isConnected) {
      const requirements = (errorResult as { error?: { data?: { accepts?: Array<Record<string, unknown>> } } })?.error?.data?.accepts?.[0];
      if (requirements) paymentPayload = await signPayment(requirements as unknown as Parameters<typeof signPayment>[0]);
    }

    await delay(300);
    const retryBody = {
      jsonrpc: "2.0", id: 2,
      method: "tools/call",
      params: { name: tool.name, arguments: { symbol: "BTC", timeframe: "1d" }, _meta: { "t402/payment": paymentPayload } },
    };
    addMsg({ role: "system", text: "→ tools/call + t402/payment", json: retryBody });

    const retryResponse = await fetch("/api/demo/mcp-tool", { method: "POST", headers, body: JSON.stringify(retryBody) });
    const result = await retryResponse.json();

    await delay(200);
    addMsg({ role: "system", text: "Payment verified — tool access granted", type: "success" });

    await delay(300);
    const toolText = (result as { result?: { content?: Array<{ text?: string }> } })?.result?.content?.[0]?.text || "Analysis complete.";
    addMsg({ role: "agent", text: toolText });

    setRunning(false);
  }, [selectedTool, isDemo, isConnected, signPayment, addMsg]);

  return (
    <div className="flex h-full flex-col p-6">
      {/* Top: Tool selector + action */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-2">
          {toolOptions.map((t, i) => (
            <button
              key={t.name}
              onClick={() => !running && setSelectedTool(i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                selectedTool === i
                  ? "bg-purple-600/20 text-purple-400 ring-1 ring-purple-500/30"
                  : "text-[var(--color-muted)] hover:text-white"
              }`}
            >
              {t.label} ({t.cost})
            </button>
          ))}
        </div>
        <button
          onClick={runDemo}
          disabled={running}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition-colors ml-auto disabled:opacity-50"
        >
          <Wrench size={14} />
          {running ? "Running..." : "Call Tool"}
        </button>
      </div>

      {/* Chat */}
      <div className="flex-1 border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-code-bg)]">
        <div className="border-b border-[var(--color-border)] px-4 py-2">
          <span className="text-xs text-[var(--color-muted)]">Agent ↔ MCP Server (JSON-RPC 2.0)</span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: "calc(100% - 36px)" }}>
          {messages.length === 0 && (
            <div className="flex h-48 items-center justify-center text-sm text-[var(--color-muted)]">
              Select a tool and click &quot;Call Tool&quot;
            </div>
          )}
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-lg px-4 py-2.5 ${
                msg.type === "payment" ? "border border-amber-500/30 bg-amber-500/10"
                  : msg.type === "success" ? "border border-green-500/30 bg-green-500/10"
                    : msg.role === "user" ? "bg-blue-500/10"
                      : msg.role === "agent" ? "bg-purple-500/5"
                        : "bg-white/[0.02]"
              }`}
            >
              <div className="mb-0.5 text-[10px] font-medium uppercase text-white/30">{msg.role}</div>
              <div className={`text-sm ${
                msg.type === "payment" ? "text-amber-300" : msg.type === "success" ? "text-green-300" : "text-white/90"
              }`}>
                {msg.text}
              </div>
              {msg.json != null ? (
                <pre className="mt-1.5 max-h-[100px] overflow-y-auto rounded bg-black/30 p-2 font-mono text-[11px] text-gray-400 leading-relaxed">
                  {JSON.stringify(msg.json, null, 2)}
                </pre>
              ) : null}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
