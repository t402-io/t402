import type { Metadata } from "next";
import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { AgentToAgent } from "@/components/scenarios/AgentToAgent";

// Force dynamic rendering to avoid SSR issues with wallet SDKs
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent-to-Agent Payments | T402 Demo",
  description: "AI agents delegate tasks and pay each other via HTTP 402. Pure machine-to-machine USDT micropayments.",
  openGraph: {
    title: "Agent-to-Agent Payments — T402",
    description: "Autonomous AI agents paying each other with USDT.",
  },
};

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
