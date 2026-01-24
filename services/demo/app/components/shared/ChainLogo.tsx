"use client";

import type { ChainFamily } from "@/lib/testnet-config";

const CHAIN_SVGS: Record<ChainFamily, (size: number) => React.ReactNode> = {
  evm: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 1.5L4.5 12.2L12 16.5L19.5 12.2L12 1.5Z" fill="#627EEA" opacity="0.8" />
      <path d="M12 16.5L4.5 12.2L12 22.5L19.5 12.2L12 16.5Z" fill="#627EEA" />
    </svg>
  ),
  ton: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#0098EA" />
      <path d="M7 8H17L12 18L7 8Z" fill="white" opacity="0.9" />
    </svg>
  ),
  tron: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L22 8V16L12 22L2 16V8L12 2Z" fill="#FF0013" opacity="0.9" />
      <path d="M12 6L17 10L12 18L7 10L12 6Z" fill="white" opacity="0.9" />
    </svg>
  ),
  solana: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 17.5L8 14.5H21L18 17.5H5Z" fill="#9945FF" />
      <path d="M5 6.5L8 9.5H21L18 6.5H5Z" fill="#9945FF" />
      <path d="M5 12L8 9H21L18 12H5Z" fill="#14F195" />
    </svg>
  ),
  stacks: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 7L12 2L20 7" stroke="#5546FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12H20" stroke="#5546FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17L12 22L20 17" stroke="#5546FF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

interface ChainLogoProps {
  family: ChainFamily;
  size?: number;
  className?: string;
}

export function ChainLogo({ family, size = 16, className }: ChainLogoProps) {
  return (
    <span className={className} aria-hidden="true">
      {CHAIN_SVGS[family](size)}
    </span>
  );
}
