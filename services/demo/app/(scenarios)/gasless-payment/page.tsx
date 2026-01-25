import type { Metadata } from "next";
import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { GaslessPayment } from "@/components/scenarios/GaslessPayment";

// Force dynamic rendering to avoid SSR issues with wallet SDKs
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gasless Payment | T402 Demo",
  description: "No ETH needed. ERC-4337 account abstraction handles gas — users only pay USDT via HTTP 402.",
  openGraph: {
    title: "Gasless Payment — T402",
    description: "Gasless USDT payments with ERC-4337 account abstraction.",
  },
};

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
