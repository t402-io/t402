import type { Metadata } from "next";
import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { CrossChainBridge } from "@/components/scenarios/CrossChainBridge";

// Force dynamic rendering to avoid SSR issues with wallet SDKs
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cross-Chain Bridge | T402 Demo",
  description: "Pay on one chain, settle on another. LayerZero USDT0 enables seamless cross-chain HTTP 402 payments.",
  openGraph: {
    title: "Cross-Chain Bridge — T402",
    description: "Cross-chain USDT0 payments via LayerZero + HTTP 402.",
  },
};

export default function CrossChainBridgePage() {
  return (
    <ScenarioShell
      iconName="arrowleftright"
      title="Cross-Chain Bridge"
      description="Bridge USDT0 across 22 EVM chains via LayerZero. Pay 0.01 USDT per bridge — real on-chain settlement."
      cost="0.01 USDT/bridge"
      accentColor="var(--color-scenario-bridge)"
      scenarioId="cross-chain-bridge"
      hideChainSelector
      hideChecklist
    >
      <CrossChainBridge />
    </ScenarioShell>
  );
}
