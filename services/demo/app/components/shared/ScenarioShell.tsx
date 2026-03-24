"use client";

import { ChainSelector } from "./ChainSelector";
import { ChainBadge } from "./ChainBadge";
import { TokenBalance } from "./TokenBalance";
import { FaucetLink } from "./FaucetLink";
import { SdkExamples } from "./SdkExamples";
import { PaymentChecklist } from "./PaymentChecklist";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import type { ScenarioId } from "@/lib/sdk-examples";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

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
  const { isLive, testnet } = useDemoContext();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Brand accent line */}
      <div
        className="h-0.5 w-16 rounded-full mb-8"
        style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }}
      />
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">{title}</h1>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full w-fit"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {cost}
          </span>
        </div>
        <p className="text-sm max-w-xl mb-5 leading-relaxed text-[var(--color-muted)]">{description}</p>
        <div className="flex flex-col gap-2">
          <ChainSelector />
          <div className="flex items-center gap-2 flex-wrap">
            <ChainBadge family={activeFamily} showNetwork />
            {isLive && <TokenBalance />}
          </div>
        </div>
        {isLive && testnet ? (
          <div className="mt-4">
            <FaucetLink family={activeFamily} />
          </div>
        ) : isLive && !testnet ? (
          <div className="mt-4 flex items-center gap-1.5 text-[10px]" style={{ color: "#EF4444" }}>
            <AlertTriangle size={12} />
            <span>Mainnet — real funds will be used for payments</span>
          </div>
        ) : (
          <p className="text-[10px] mt-4" style={{ color: "var(--color-muted)" }}>
            Demo mode uses a simulated wallet. Switch to Live to test with real tokens.
          </p>
        )}
      </div>
      <PaymentChecklist />
      {children}
      {scenarioId && <SdkExamples scenarioId={scenarioId} />}
    </div>
  );
}
