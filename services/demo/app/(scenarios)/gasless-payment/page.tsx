"use client";

import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { GaslessPayment } from "@/components/scenarios/GaslessPayment";

export default function GaslessPaymentPage() {
  return (
    <ScenarioShell
      title="Gasless Payment"
      description="No ETH needed. ERC-4337 account abstraction handles gas — users only pay USDT."
      cost="0.001 USDT"
      accentColor="var(--color-scenario-gasless)"
      scenarioId="gasless-payment"
    >
      <GaslessPayment />
    </ScenarioShell>
  );
}
