import type { Metadata } from "next";
import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { StreamingMedia } from "@/components/scenarios/StreamingMedia";

export const metadata: Metadata = {
  title: "Streaming Media | T402 Demo",
  description: "Pay-per-second audio streaming with USDT. No subscriptions — listen and pay as you go via HTTP 402.",
  openGraph: {
    title: "Streaming Media — T402",
    description: "Pay 0.001 USDT per 10 seconds of streaming.",
  },
};

export default function StreamingMediaPage() {
  return (
    <ScenarioShell
      title="Streaming Media"
      description="Pay-per-second audio streaming. No subscriptions, just listen and pay as you go."
      cost="0.001 USDT/10s"
      accentColor="var(--color-scenario-stream)"
      scenarioId="streaming-media"
    >
      <StreamingMedia />
    </ScenarioShell>
  );
}
