"use client";

import { ExternalLink, Droplets, Coins } from "lucide-react";
import { CHAIN_CONFIGS, type ChainFamily } from "@/lib/testnet-config";

interface FaucetLinkProps {
  family: ChainFamily;
  className?: string;
}

export function FaucetLink({ family, className }: FaucetLinkProps) {
  const config = CHAIN_CONFIGS[family];

  const sameUrl = config.gasFaucet === config.tokenFaucet;

  return (
    <div className={`flex flex-col gap-1.5 ${className || ""}`}>
      <a
        href={config.gasFaucet}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-info)] hover:underline"
      >
        <Droplets size={12} />
        <span>Gas: {config.gasFaucetLabel}</span>
        <ExternalLink size={10} />
      </a>
      {!sameUrl && (
        <a
          href={config.tokenFaucet}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-info)] hover:underline"
        >
          <Coins size={12} />
          <span>Token: {config.tokenFaucetLabel}</span>
          <ExternalLink size={10} />
        </a>
      )}
      {sameUrl && (
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-muted)]">
          <Coins size={10} />
          <span>{config.tokenFaucetLabel}</span>
        </span>
      )}
    </div>
  );
}
