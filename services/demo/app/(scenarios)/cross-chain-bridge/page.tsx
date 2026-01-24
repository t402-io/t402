"use client";

import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { CrossChainBridge } from "@/components/scenarios/CrossChainBridge";

export default function CrossChainBridgePage() {
  return (
    <ScenarioShell
      title="Cross-Chain Bridge"
      description="Pay on one chain, settle on another. LayerZero USDT0 enables seamless cross-chain payments."
      cost="0.01 USDT/bridge"
      accentColor="var(--color-scenario-bridge)"
      scenarioId="cross-chain-bridge"
    >
      <CrossChainBridge />
    </ScenarioShell>
  );
}
