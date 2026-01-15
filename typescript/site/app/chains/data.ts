/**
 * Blockchain Chain Data for t402
 */

export type ChainCategory = "evm" | "svm" | "ton" | "tron";

export interface Token {
  symbol: string;
  name: string;
  type: "eip3009" | "legacy" | "spl" | "jetton" | "trc20";
  address?: string;
  gasless?: boolean;
}

export interface Chain {
  id: string;
  name: string;
  shortName: string;
  category: ChainCategory;
  chainId?: number | string;
  color: string;
  icon: string;
  description: string;
  tokens: Token[];
  features: string[];
  explorerUrl: string;
  docsUrl: string;
  status: "live" | "coming_soon" | "testnet";
  transactionSpeed: string;
  avgFee: string;
}

export const chains: Chain[] = [
  // EVM Chains
  {
    id: "ethereum",
    name: "Ethereum",
    shortName: "ETH",
    category: "evm",
    chainId: 1,
    color: "#627EEA",
    icon: "ethereum",
    description: "The original smart contract platform. Highest security and decentralization with the largest DeFi ecosystem.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", gasless: true },
      { symbol: "USDC", name: "USD Coin", type: "eip3009", gasless: true },
      { symbol: "USDT", name: "Tether USD (Legacy)", type: "legacy" },
    ],
    features: ["EIP-3009 Gasless", "LayerZero Bridge", "ERC-4337", "Highest Security"],
    explorerUrl: "https://etherscan.io",
    docsUrl: "https://docs.t402.io/chains/ethereum",
    status: "live",
    transactionSpeed: "~12 sec",
    avgFee: "$2-10",
  },
  {
    id: "base",
    name: "Base",
    shortName: "BASE",
    category: "evm",
    chainId: 8453,
    color: "#0052FF",
    icon: "base",
    description: "Coinbase's L2 built on Optimism. Fast, low-cost transactions with strong institutional backing.",
    tokens: [
      { symbol: "USDC", name: "USD Coin", type: "eip3009", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Sub-second finality", "Coinbase ecosystem", "Low fees"],
    explorerUrl: "https://basescan.org",
    docsUrl: "https://docs.t402.io/chains/base",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },
  {
    id: "arbitrum",
    name: "Arbitrum One",
    shortName: "ARB",
    category: "evm",
    chainId: 42161,
    color: "#28A0F0",
    icon: "arbitrum",
    description: "Leading Ethereum L2 with optimistic rollups. High throughput and low fees with full EVM compatibility.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", gasless: true },
      { symbol: "USDC", name: "USD Coin", type: "eip3009", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Optimistic rollup", "High throughput", "DeFi hub"],
    explorerUrl: "https://arbiscan.io",
    docsUrl: "https://docs.t402.io/chains/arbitrum",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },
  {
    id: "polygon",
    name: "Polygon",
    shortName: "MATIC",
    category: "evm",
    chainId: 137,
    color: "#8247E5",
    icon: "polygon",
    description: "Popular EVM sidechain with high throughput. Large ecosystem and widespread adoption.",
    tokens: [
      { symbol: "USDC", name: "USD Coin", type: "eip3009", gasless: true },
      { symbol: "USDT", name: "Tether USD (Legacy)", type: "legacy" },
    ],
    features: ["EIP-3009 Gasless", "High throughput", "Large ecosystem", "zkEVM coming"],
    explorerUrl: "https://polygonscan.com",
    docsUrl: "https://docs.t402.io/chains/polygon",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },
  {
    id: "berachain",
    name: "Berachain",
    shortName: "BERA",
    category: "evm",
    chainId: 80094,
    color: "#FF6B00",
    icon: "berachain",
    description: "Novel proof-of-liquidity consensus chain. Built for DeFi with innovative tokenomics.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Proof of Liquidity", "Native DeFi", "LayerZero bridge"],
    explorerUrl: "https://berascan.com",
    docsUrl: "https://docs.t402.io/chains/berachain",
    status: "live",
    transactionSpeed: "~1 sec",
    avgFee: "<$0.01",
  },
  {
    id: "unichain",
    name: "Unichain",
    shortName: "UNI",
    category: "evm",
    chainId: 130,
    color: "#FF007A",
    icon: "unichain",
    description: "Uniswap's dedicated L2 chain. Optimized for trading with MEV protection and fast finality.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "MEV protection", "Fast swaps", "Uniswap native"],
    explorerUrl: "https://uniscan.xyz",
    docsUrl: "https://docs.t402.io/chains/unichain",
    status: "live",
    transactionSpeed: "~1 sec",
    avgFee: "<$0.01",
  },
  {
    id: "ink",
    name: "Ink",
    shortName: "INK",
    category: "evm",
    chainId: 57073,
    color: "#7B3FE4",
    icon: "ink",
    description: "Kraken's L2 chain built on Optimism. Institutional-grade security with CEX integration.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Kraken ecosystem", "Institutional grade", "OP Stack"],
    explorerUrl: "https://explorer.inkonchain.com",
    docsUrl: "https://docs.t402.io/chains/ink",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },

  // Non-EVM Chains
  {
    id: "solana",
    name: "Solana",
    shortName: "SOL",
    category: "svm",
    color: "#9945FF",
    icon: "solana",
    description: "High-performance L1 with sub-second finality. Massive throughput for payments and trading.",
    tokens: [
      { symbol: "USDC", name: "USD Coin", type: "spl" },
      { symbol: "USDT", name: "Tether USD", type: "spl" },
    ],
    features: ["Sub-second finality", "High throughput", "Low fees", "Large ecosystem"],
    explorerUrl: "https://solscan.io",
    docsUrl: "https://docs.t402.io/chains/solana",
    status: "live",
    transactionSpeed: "~400ms",
    avgFee: "<$0.001",
  },
  {
    id: "ton",
    name: "TON",
    shortName: "TON",
    category: "ton",
    color: "#0098EA",
    icon: "ton",
    description: "Telegram's blockchain with 950M+ user reach. Seamless Telegram integration for social payments.",
    tokens: [
      { symbol: "USDT", name: "Tether USD (Jetton)", type: "jetton" },
    ],
    features: ["Telegram integration", "950M+ users", "Fast finality", "Jetton standard"],
    explorerUrl: "https://tonscan.org",
    docsUrl: "https://docs.t402.io/chains/ton",
    status: "live",
    transactionSpeed: "~5 sec",
    avgFee: "<$0.01",
  },
  {
    id: "tron",
    name: "TRON",
    shortName: "TRX",
    category: "tron",
    color: "#FF0000",
    icon: "tron",
    description: "High-throughput chain with massive USDT adoption. #1 chain for stablecoin transfers globally.",
    tokens: [
      { symbol: "USDT", name: "Tether USD (TRC-20)", type: "trc20" },
    ],
    features: ["#1 USDT chain", "High throughput", "Low fees", "Global adoption"],
    explorerUrl: "https://tronscan.org",
    docsUrl: "https://docs.t402.io/chains/tron",
    status: "live",
    transactionSpeed: "~3 sec",
    avgFee: "<$1",
  },
];

export const categories: { id: ChainCategory; name: string; description: string }[] = [
  {
    id: "evm",
    name: "EVM Chains",
    description: "Ethereum Virtual Machine compatible chains with smart contract support",
  },
  {
    id: "svm",
    name: "Solana",
    description: "Solana Virtual Machine with high throughput and low latency",
  },
  {
    id: "ton",
    name: "TON",
    description: "The Open Network with Telegram integration",
  },
  {
    id: "tron",
    name: "TRON",
    description: "High-throughput chain optimized for stablecoin transfers",
  },
];

export const features = [
  {
    id: "gasless",
    name: "Gasless Transactions",
    description: "EIP-3009 enables gasless USDT/USDC transfers on supported chains",
    icon: "gasless",
  },
  {
    id: "bridge",
    name: "Cross-Chain Bridge",
    description: "LayerZero OFT standard enables seamless USDT0 bridging across chains",
    icon: "bridge",
  },
  {
    id: "erc4337",
    name: "Account Abstraction",
    description: "ERC-4337 support for smart contract wallets and batch transactions",
    icon: "wallet",
  },
  {
    id: "multisig",
    name: "Multi-Sig Support",
    description: "Safe and other multi-signature wallets supported on EVM chains",
    icon: "multisig",
  },
];

export function getChainsByCategory(category: ChainCategory): Chain[] {
  return chains.filter((chain) => chain.category === category);
}

export function getChainById(id: string): Chain | undefined {
  return chains.find((chain) => chain.id === id);
}

export function getLiveChains(): Chain[] {
  return chains.filter((chain) => chain.status === "live");
}

export function getChainsWithGasless(): Chain[] {
  return chains.filter((chain) =>
    chain.tokens.some((token) => token.gasless)
  );
}
