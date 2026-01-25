import type { Metadata } from "next";
import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { McpAiAgent } from "@/components/scenarios/McpAiAgent";

// Force dynamic rendering to avoid SSR issues with wallet SDKs
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MCP AI Agent | T402 Demo",
  description: "AI agent autonomously pays for tools via Model Context Protocol. HTTP 402 enables machine-to-machine USDT payments.",
  openGraph: {
    title: "MCP AI Agent — T402",
    description: "AI agents paying for tools autonomously via MCP + T402.",
  },
};

export default function McpAiAgentPage() {
  return (
    <ScenarioShell
      title="MCP AI Agent"
      description="AI agent autonomously pays for tools and resources via Model Context Protocol."
      cost="0.001 USDT/tool"
      accentColor="var(--color-scenario-mcp)"
      scenarioId="mcp-ai-agent"
    >
      <McpAiAgent />
    </ScenarioShell>
  );
}
