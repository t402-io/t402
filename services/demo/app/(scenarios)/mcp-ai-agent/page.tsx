"use client";

import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { McpAiAgent } from "@/components/scenarios/McpAiAgent";

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
