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
  near: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#00C08B" />
      <path d="M8 16V8L12 12L16 8V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  aptos: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#2DD4BF" />
      <path d="M8 12H16M12 8V16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" fill="none" />
    </svg>
  ),
  tezos: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 7V17L12 22L20 17V7L12 2Z" fill="#2C7DF7" />
      <path d="M12 6V18M8 9L16 15M16 9L8 15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  polkadot: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#E6007A" />
      <circle cx="12" cy="6" r="2" fill="white" />
      <circle cx="12" cy="12" r="2" fill="white" />
      <circle cx="12" cy="18" r="2" fill="white" />
      <circle cx="7" cy="9" r="1.5" fill="white" opacity="0.7" />
      <circle cx="17" cy="9" r="1.5" fill="white" opacity="0.7" />
      <circle cx="7" cy="15" r="1.5" fill="white" opacity="0.7" />
      <circle cx="17" cy="15" r="1.5" fill="white" opacity="0.7" />
    </svg>
  ),
  cosmos: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#2E3148" />
      <circle cx="12" cy="12" r="3" fill="#B7B9C8" />
      <ellipse cx="12" cy="12" rx="8" ry="4" stroke="#B7B9C8" strokeWidth="1" fill="none" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="8" ry="4" stroke="#B7B9C8" strokeWidth="1" fill="none" transform="rotate(-60 12 12)" />
      <ellipse cx="12" cy="12" rx="8" ry="4" stroke="#B7B9C8" strokeWidth="1" fill="none" />
    </svg>
  ),
  stellar: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#7B61FF" />
      <path d="M6 10L18 5L16 11H6Z" fill="white" opacity="0.9" />
      <path d="M18 14L6 19L8 13H18Z" fill="white" opacity="0.9" />
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
