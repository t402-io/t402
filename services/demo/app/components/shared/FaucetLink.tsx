"use client";

import { ExternalLink, Droplets } from "lucide-react";
import { getFaucetUrl, CHAIN_CONFIGS, type ChainFamily } from "@/lib/testnet-config";

interface FaucetLinkProps {
  family: ChainFamily;
  className?: string;
}

export function FaucetLink({ family, className }: FaucetLinkProps) {
  const url = getFaucetUrl(family);
  const config = CHAIN_CONFIGS[family];

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs text-[var(--color-info)] hover:underline ${className || ""}`}
    >
      <Droplets size={12} />
      <span>Get test {config.tokenSymbol} on {config.name}</span>
      <ExternalLink size={10} />
    </a>
  );
}
