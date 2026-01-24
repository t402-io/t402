"use client";

import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { AgentToAgent } from "@/components/scenarios/AgentToAgent";

export default function AgentToAgentPage() {
  return (
    <ScenarioShell
      title="Agent-to-Agent"
      description="AI agents delegate tasks and pay each other automatically. Pure machine-to-machine payments."
      cost="0.001 USDT/task"
      accentColor="var(--color-scenario-agent)"
      scenarioId="agent-to-agent"
    >
      <AgentToAgent />
    </ScenarioShell>
  );
}
