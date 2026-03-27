import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { ContentPaywall } from "@/components/scenarios/ContentPaywall";

// Force dynamic rendering to avoid SSR issues with wallet SDKs
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Content Paywall | T402 Demo",
  description: "Replace subscriptions with one-time USDT payments per article. HTTP 402 enables pay-per-read without accounts.",
  openGraph: {
    title: "Content Paywall — T402",
    description: "Pay 0.01 USDT per article. No subscriptions, no accounts.",
  },
};

export default function ContentPaywallPage() {
  return (
    <ScenarioShell
      icon={FileText}
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
