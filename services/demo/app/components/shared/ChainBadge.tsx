"use client";

import { type ChainFamily } from "@/lib/testnet-config";
import { useChainContext } from "@/providers/ChainProvider";
import { ChainLogo } from "./ChainLogo";
import clsx from "clsx";

interface ChainBadgeProps {
  family: ChainFamily;
  showNetwork?: boolean;
  className?: string;
}

export function ChainBadge({ family, showNetwork = false, className }: ChainBadgeProps) {
  const { activeConfig } = useChainContext();

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        className
      )}
      style={{ background: `${activeConfig.color}20`, color: activeConfig.color }}
    >
      <ChainLogo family={family} size={12} />
      {activeConfig.label}
      {showNetwork && (
        <span className="opacity-60 text-[10px]">{activeConfig.name} · {activeConfig.tokenSymbol}</span>
      )}
    </span>
  );
}
