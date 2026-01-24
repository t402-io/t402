"use client";

import { useState, useCallback } from "react";
import { useDemoContext } from "@/providers/DemoProvider";
import { useMultiChainPayment } from "@/hooks/useMultiChainPayment";
import { CodeBlock } from "@/components/shared/CodeBlock";
import { Spinner } from "@/components/shared/Spinner";
import { CostTicker } from "@/components/shared/CostTicker";
import { Cloud, Globe, Calculator } from "lucide-react";

interface ToolCall {
  id: number;
  tool: string;
  status: "pending" | "paying" | "executing" | "done";
  input: Record<string, unknown>;
  output?: string;
  cost: number;
}

const AVAILABLE_TOOLS = [
  { name: "get_weather", label: "Weather", icon: Cloud, description: "Get current weather data for any city" },
  { name: "web_search", label: "Web Search", icon: Globe, description: "Search the web for information" },
  { name: "calculate", label: "Calculator", icon: Calculator, description: "Perform mathematical calculations" },
];

export function McpAiAgent() {
  const { isDemo } = useDemoContext();
  const { signPayment, activeFamily } = useMultiChainPayment();
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [agentThinking, setAgentThinking] = useState(false);

  const executeTool = useCallback(async (toolName: string) => {
    const callId = Date.now();
    const toolInput = toolName === "get_weather" ? { city: "Tokyo" } : toolName === "web_search" ? { query: "T402 protocol" } : { expression: "42 * 1337" };
    const newCall: ToolCall = {
      id: callId,
      tool: toolName,
      status: "pending",
      input: toolInput,
      cost: 0.001,
    };

    setToolCalls((prev) => [...prev, newCall]);
    setAgentThinking(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-preferred-chain": activeFamily,
      };
      if (isDemo) headers["x-demo-mode"] = "true";

      // Step 1: Call MCP tool without payment (gets 402)
      await new Promise((r) => setTimeout(r, 300));
      setToolCalls((prev) => prev.map((c) => c.id === callId ? { ...c, status: "paying" } : c));

      const mcpRequest = {
        jsonrpc: "2.0",
        id: callId,
        method: "tools/call",
        params: { name: toolName, arguments: toolInput },
      };

      const initialRes = await fetch("/api/demo/mcp-tool", {
        method: "POST",
        headers,
        body: JSON.stringify(mcpRequest),
      });

      const initialData = await initialRes.json();

      // Check for 402 error in MCP response
      if (initialData.error?.code === 402) {
        const requirements = initialData.error.data.accepts[0];
        const paymentPayload = await signPayment(requirements);

        setToolCalls((prev) => prev.map((c) => c.id === callId ? { ...c, status: "executing" } : c));

        // Step 2: Retry with payment in _meta
        const retryRequest = {
          ...mcpRequest,
          params: {
            ...mcpRequest.params,
            _meta: { "t402/payment": paymentPayload },
          },
        };

        const retryRes = await fetch("/api/demo/mcp-tool", {
          method: "POST",
          headers,
          body: JSON.stringify(retryRequest),
        });

        const retryData = await retryRes.json();
        const output = retryData.result?.content?.[0]?.text || JSON.stringify(retryData.result);

        setToolCalls((prev) => prev.map((c) =>
          c.id === callId ? { ...c, status: "done", output } : c
        ));
        setTotalCost((prev) => prev + 0.001);
      }
    } catch {
      setToolCalls((prev) => prev.map((c) =>
        c.id === callId ? { ...c, status: "done", output: "Error executing tool" } : c
      ));
    } finally {
      setAgentThinking(false);
    }
  }, [isDemo, activeFamily, signPayment]);

  return (
    <div className="space-y-6">
      {/* Available tools */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {AVAILABLE_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.name}
              onClick={() => executeTool(tool.name)}
              disabled={agentThinking}
              className="glass-card-interactive p-4 text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-[var(--color-scenario-mcp)]" />
                <span className="text-xs font-semibold">{tool.label}</span>
              </div>
              <p className="text-[10px] text-[var(--color-muted)]">{tool.description}</p>
              <p className="text-[10px] text-[var(--color-scenario-mcp)] mt-1">0.001 USDT/call</p>
            </button>
          );
        })}
      </div>

      {totalCost > 0 && <CostTicker totalCost={totalCost} />}

      {/* Tool call log */}
      {toolCalls.length > 0 && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            MCP Tool Calls
          </h3>
          {toolCalls.map((call) => (
            <div key={call.id} className="border border-[var(--color-border)] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-medium">{call.tool}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  call.status === "done" ? "bg-[var(--color-success-dim)] text-[var(--color-success)]" :
                  call.status === "paying" ? "bg-[var(--color-warning-dim)] text-[var(--color-warning)]" :
                  "bg-[var(--color-info-dim)] text-[var(--color-info)]"
                }`}>
                  {call.status === "paying" ? "402 → Paying..." : call.status === "executing" ? "Executing..." : call.status === "done" ? "Complete" : "Pending"}
                </span>
              </div>
              <div className="text-[10px] text-[var(--color-muted)] mb-1">
                Input: <code>{JSON.stringify(call.input)}</code>
              </div>
              {call.status !== "done" && call.status !== "pending" && <Spinner />}
              {call.output && (
                <CodeBlock code={call.output} language="json" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
