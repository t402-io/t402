"use client";

import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { ContentPaywall } from "@/components/scenarios/ContentPaywall";

export default function ContentPaywallPage() {
  return (
    <ScenarioShell
      title="Content Paywall"
      description="Replace subscription fatigue with one-time payments. Readers pay only for what they read."
      cost="0.01 USDT/article"
      accentColor="var(--color-scenario-content)"
      scenarioId="content-paywall"
    >
      <ContentPaywall />
    </ScenarioShell>
  );
}
