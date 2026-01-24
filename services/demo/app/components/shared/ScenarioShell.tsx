"use client";

import { ChainSelector } from "./ChainSelector";
import { ChainBadge } from "./ChainBadge";
import { FaucetLink } from "./FaucetLink";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import type { ReactNode } from "react";

interface ScenarioShellProps {
  title: string;
  description: string;
  cost: string;
  accentColor: string;
  children: ReactNode;
}

export function ScenarioShell({ title, description, cost, accentColor, children }: ScenarioShellProps) {
  const { activeFamily } = useChainContext();
  const { isLive } = useDemoContext();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
          <span
            className="text-xs px-2.5 py-1 rounded-full w-fit"
            style={{ background: `${accentColor}20`, color: accentColor }}
          >
            {cost}
          </span>
        </div>
        <p className="text-sm text-[var(--color-muted)] max-w-xl mb-4">{description}</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <ChainSelector />
          <ChainBadge family={activeFamily} showNetwork />
        </div>
        {isLive && (
          <div className="mt-3">
            <FaucetLink family={activeFamily} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
