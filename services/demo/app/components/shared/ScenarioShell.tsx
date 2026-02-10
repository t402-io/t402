"use client";

import { ChainSelector } from "./ChainSelector";
import { ChainBadge } from "./ChainBadge";
import { FaucetLink } from "./FaucetLink";
import { SdkExamples } from "./SdkExamples";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import type { ScenarioId } from "@/lib/sdk-examples";
import type { ReactNode } from "react";

interface ScenarioShellProps {
  title: string;
  description: string;
  cost: string;
  accentColor: string;
  scenarioId?: ScenarioId;
  children: ReactNode;
}

export function ScenarioShell({ title, description, cost, accentColor, scenarioId, children }: ScenarioShellProps) {
  const { activeFamily } = useChainContext();
  const { isLive } = useDemoContext();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Brand accent line */}
      <div
        className="h-0.5 w-16 rounded-full mb-8"
        style={{ background: "linear-gradient(90deg, #50AF95, transparent)" }}
      />
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full w-fit"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {cost}
          </span>
        </div>
        <p className="text-sm max-w-xl mb-5 leading-relaxed" style={{ color: "#A1A1AA" }}>{description}</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <ChainSelector />
          <ChainBadge family={activeFamily} showNetwork />
        </div>
        {isLive && (
          <div className="mt-4">
            <FaucetLink family={activeFamily} />
          </div>
        )}
      </div>
      {children}
      {scenarioId && <SdkExamples scenarioId={scenarioId} />}
    </div>
  );
}
