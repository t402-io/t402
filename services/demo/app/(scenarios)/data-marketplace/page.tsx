import type { Metadata } from "next";
import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { DataMarketplace } from "@/components/scenarios/DataMarketplace";

export const metadata: Metadata = {
  title: "Data Marketplace | T402 Demo",
  description: "Pay-per-request market data with USDT micropayments. No monthly minimums, no API keys — instant on-chain settlement.",
  openGraph: {
    title: "Data Marketplace — T402",
    description: "Pay 0.001 USDT per data request. No monthly minimums.",
  },
};

export default function DataMarketplacePage() {
  return (
    <ScenarioShell
      title="Data Marketplace"
      description="Pay-per-request market data. No monthly minimums — just USDT micropayments."
      cost="0.001 USDT/request"
      accentColor="var(--color-scenario-data)"
      scenarioId="data-marketplace"
    >
      <DataMarketplace />
    </ScenarioShell>
  );
}
