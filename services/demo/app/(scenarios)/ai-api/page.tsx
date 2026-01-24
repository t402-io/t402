"use client";

import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { AiApiScenario } from "@/components/scenarios/AiApiScenario";

export default function AiApiPage() {
  return (
    <ScenarioShell
      title="AI API Monetization"
      description="No API keys. No subscriptions. Agents and users pay 0.001 USDT per query — instantly settled on-chain."
      cost="0.001 USDT/query"
      accentColor="var(--color-scenario-ai)"
      scenarioId="ai-api"
    >
      <AiApiScenario />
    </ScenarioShell>
  );
}
