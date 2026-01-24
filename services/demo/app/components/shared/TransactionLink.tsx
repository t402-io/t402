"use client";

import { ExternalLink } from "lucide-react";
import { getExplorerUrl, type ChainFamily } from "@/lib/testnet-config";
import { ChainLogo } from "./ChainLogo";

interface TransactionLinkProps {
  txHash: string;
  family: ChainFamily;
  className?: string;
}

export function TransactionLink({ txHash, family, className }: TransactionLinkProps) {
  const url = getExplorerUrl(family, txHash);
  const shortHash = `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs text-[var(--color-brand)] hover:underline ${className || ""}`}
      aria-label={`View transaction ${shortHash} on explorer`}
    >
      <ChainLogo family={family} size={12} />
      <code>{shortHash}</code>
      <ExternalLink size={10} />
    </a>
  );
}
