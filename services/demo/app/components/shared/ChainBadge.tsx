"use client";

import { CHAIN_CONFIGS, type ChainFamily } from "@/lib/testnet-config";
import { ChainLogo } from "./ChainLogo";
import clsx from "clsx";

interface ChainBadgeProps {
  family: ChainFamily;
  showNetwork?: boolean;
  className?: string;
}

export function ChainBadge({ family, showNetwork = false, className }: ChainBadgeProps) {
  const config = CHAIN_CONFIGS[family];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        className
      )}
      style={{ background: `${config.color}20`, color: config.color }}
    >
      <ChainLogo family={family} size={12} />
      {config.label}
      {showNetwork && (
        <span className="opacity-60 text-[10px]">{config.name}</span>
      )}
    </span>
  );
}
