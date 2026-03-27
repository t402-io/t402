import type { Metadata } from "next";
import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { AiApiScenario } from "@/components/scenarios/AiApiScenario";

// Force dynamic rendering to avoid SSR issues with wallet SDKs
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI API Monetization | T402 Demo",
  description: "Pay-per-query AI API with USDT micropayments. No API keys, no subscriptions — just HTTP 402 and instant on-chain settlement.",
  openGraph: {
    title: "AI API Monetization — T402",
    description: "Pay 0.001 USDT per AI query. No API keys needed.",
  },
};

export default function AiApiPage() {
  return (
    <ScenarioShell
      iconName="brain"
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
