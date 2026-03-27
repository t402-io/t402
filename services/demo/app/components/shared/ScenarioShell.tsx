"use client";

import { ChainBadge } from "./ChainBadge";
import { TokenBalance } from "./TokenBalance";
import { FaucetLink } from "./FaucetLink";
import { SdkExamples } from "./SdkExamples";
import { PaymentChecklist } from "./PaymentChecklist";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import type { ScenarioId } from "@/lib/sdk-examples";
import type { ReactNode } from "react";
import {
  AlertTriangle, Brain, FileText, Database, Bot,
  Cpu, Radio, Wand2, ArrowLeftRight, Zap, Repeat,
  type LucideIcon,
} from "lucide-react";
import { WalletChainIndicator } from "./WalletChainIndicator";

const ICON_MAP: Record<string, LucideIcon> = {
  brain: Brain, filetext: FileText, database: Database, bot: Bot,
  cpu: Cpu, radio: Radio, wand2: Wand2, arrowleftright: ArrowLeftRight,
  zap: Zap, repeat: Repeat,
};

interface ScenarioShellProps {
  title: string;
  description: string;
  cost: string;
  accentColor: string;
  iconName?: string;
  scenarioId?: ScenarioId;
  hideChecklist?: boolean;
  hideChainSelector?: boolean;
  children: ReactNode;
}

export function ScenarioShell({ title, description, cost, accentColor, iconName, scenarioId, hideChecklist, hideChainSelector, children }: ScenarioShellProps) {
  const Icon = iconName ? ICON_MAP[iconName] : undefined;
  const { activeFamily } = useChainContext();
  const { isLive, testnet } = useDemoContext();

  return (
    <div
      className="max-w-4xl mx-auto"
      style={{ "--scenario-accent": accentColor } as React.CSSProperties}
    >
      {/* Scenario header with gradient band */}
      <div
        className="rounded-2xl p-5 sm:p-7 mb-6"
        style={{
          background: `linear-gradient(135deg, ${accentColor}12, ${accentColor}04 50%, transparent 100%)`,
          border: `1px solid ${accentColor}15`,
        }}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          {Icon && (
            <div
              className="w-11 h-11 sm:w-13 sm:h-13 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}25`, color: accentColor }}
            >
              <Icon size={22} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 mb-1.5">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
              <span
                className="text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full w-fit"
                style={{
                  background: `${accentColor}15`,
                  color: accentColor,
                  border: `1px solid ${accentColor}25`,
                }}
              >
                {cost}
              </span>
            </div>
            <p className="text-xs sm:text-sm max-w-xl leading-relaxed text-[var(--color-muted)]">{description}</p>

            {/* Chain info row — compact */}
            {!hideChainSelector && (
              <div className="flex items-center gap-2 flex-wrap mt-3">
                <ChainBadge family={activeFamily} showNetwork />
                {isLive && <TokenBalance />}
                {isLive && <WalletChainIndicator />}
                {isLive && testnet && <FaucetLink family={activeFamily} />}
                {isLive && !testnet && (
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--color-error)" }}>
                    <AlertTriangle size={10} /> Mainnet
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {!hideChecklist && <PaymentChecklist />}
      {children}
      {scenarioId && <SdkExamples scenarioId={scenarioId} />}
    </div>
  );
}
