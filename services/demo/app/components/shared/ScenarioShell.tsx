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
import { WalletChainIndicator } from "./WalletChainIndicator";

interface ScenarioShellProps {
  title: string;
  description: string;
  cost: string;
  accentColor: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  scenarioId?: ScenarioId;
  hideChecklist?: boolean;
  hideChainSelector?: boolean;
  children: ReactNode;
}

export function ScenarioShell({ title, description, cost, accentColor, icon: Icon, scenarioId, hideChecklist, hideChainSelector, children }: ScenarioShellProps) {
  const { activeFamily } = useChainContext();
  const { isLive, testnet } = useDemoContext();

  return (
    <div
      className="max-w-4xl mx-auto"
      style={{ "--scenario-accent": accentColor } as React.CSSProperties}
    >
      {/* Scenario header with gradient band */}
      <div
        className="rounded-2xl p-6 sm:p-8 mb-8"
        style={{
          background: `linear-gradient(135deg, ${accentColor}08, transparent 60%)`,
          border: `1px solid ${accentColor}10`,
        }}
      >
        <div className="flex items-start gap-4 mb-4">
          {/* Scenario icon */}
          {Icon && (
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}20`, color: accentColor }}
            >
              <Icon size={24} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">{title}</h1>
              <span
                className="text-xs sm:text-sm font-medium px-3 py-1 rounded-full w-fit"
                style={{
                  background: `${accentColor}12`,
                  color: accentColor,
                  border: `1px solid ${accentColor}25`,
                }}
              >
                {cost}
              </span>
            </div>
            <p className="text-sm max-w-xl leading-relaxed text-[var(--color-muted)]">{description}</p>
          </div>
        </div>

        {!hideChainSelector && (
          <>
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <ChainBadge family={activeFamily} showNetwork />
                {isLive && <TokenBalance />}
                {isLive && <WalletChainIndicator />}
              </div>
            </div>
            {isLive && testnet ? (
              <div className="mt-3">
                <FaucetLink family={activeFamily} />
              </div>
            ) : isLive && !testnet ? (
              <div className="mt-3 flex items-center gap-1.5 text-[10px]" style={{ color: "var(--color-error)" }}>
                <AlertTriangle size={12} />
                <span>Mainnet — real funds will be used for payments</span>
              </div>
            ) : (
              <p className="text-[10px] mt-3" style={{ color: "var(--color-muted)" }}>
                Demo mode uses a simulated wallet. Switch to Live to test with real tokens.
              </p>
            )}
          </>
        )}
      </div>

      {!hideChecklist && <PaymentChecklist />}
      {children}
      {scenarioId && <SdkExamples scenarioId={scenarioId} />}
    </div>
  );
}
