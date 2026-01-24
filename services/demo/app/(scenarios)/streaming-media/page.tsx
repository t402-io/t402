"use client";

import { ScenarioShell } from "@/components/shared/ScenarioShell";
import { StreamingMedia } from "@/components/scenarios/StreamingMedia";

export default function StreamingMediaPage() {
  return (
    <ScenarioShell
      title="Streaming Media"
      description="Pay-per-second audio streaming. No subscriptions, just listen and pay as you go."
      cost="0.001 USDT/10s"
      accentColor="var(--color-scenario-stream)"
    >
      <StreamingMedia />
    </ScenarioShell>
  );
}
