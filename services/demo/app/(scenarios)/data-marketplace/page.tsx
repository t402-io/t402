"use client";

import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { DataMarketplace } from "@/components/scenarios/DataMarketplace";

export default function DataMarketplacePage() {
  return (
    <ScenarioShell
      title="Data Marketplace"
      description="Pay-per-request market data. No monthly minimums — just USDT micropayments."
      cost="0.001 USDT/request"
      accentColor="var(--color-scenario-data)"
    >
      <DataMarketplace />
    </ScenarioShell>
  );
}
