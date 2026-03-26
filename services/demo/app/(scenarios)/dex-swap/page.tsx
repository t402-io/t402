import type { Metadata } from "next";
import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { DexSwap } from "@/components/scenarios/DexSwap";

// Force dynamic rendering to avoid SSR issues with wallet SDKs
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DEX Swap | T402 Demo",
  description: "Pay-per-swap token exchange via ParaSwap DEX aggregator on Arbitrum.",
  openGraph: {
    title: "DEX Swap — T402",
    description: "Pay 0.01 USDT per swap quote. Real-time pricing from 10+ DEXes.",
  },
};

export default function DexSwapPage() {
  return (
    <ScenarioShell
      title="DEX Swap"
      description="Swap tokens on Arbitrum via ParaSwap. Pay 0.01 USDT per swap quote — real-time pricing from 10+ DEXes."
      cost="0.01 USDT/swap"
      accentColor="var(--color-scenario-swap)"
      scenarioId="dex-swap"
    >
      <DexSwap />
    </ScenarioShell>
  );
}
