/**
 * Blockchain Chain Data for t402
 */

export type ChainCategory = "evm" | "svm" | "ton" | "tron" | "near" | "aptos" | "tezos" | "polkadot" | "stacks" | "cosmos";

export interface Token {
  symbol: string;
  name: string;
  type: "eip3009" | "legacy" | "spl" | "jetton" | "trc20" | "nep141" | "fungible-asset" | "fa2" | "asset-hub" | "sip010" | "ibc";
  address?: string;
  gasless?: boolean;
}

export interface Chain {
  id: string;
  name: string;
  shortName: string;
  category: ChainCategory;
  chainId?: number | string;
  caip2?: string;
  color: string;
  icon: string;
  description: string;
  tokens: Token[];
  features: string[];
  explorerUrl: string;
  status: "live" | "coming_soon" | "testnet";
  transactionSpeed: string;
  avgFee: string;
}

export const chains: Chain[] = [
  // =========================================================================
  // EVM Chains (19 USDT0 networks + legacy)
  // =========================================================================
  {
    id: "ethereum",
    name: "Ethereum",
    shortName: "ETH",
    category: "evm",
    chainId: 1,
    caip2: "eip155:1",
    color: "#627EEA",
    icon: "ethereum",
    description: "The original smart contract platform. Highest security and decentralization with the largest DeFi ecosystem.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee", gasless: true },
      { symbol: "USDT", name: "Tether USD (Legacy)", type: "legacy", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    ],
    features: ["EIP-3009 Gasless", "LayerZero Bridge", "ERC-4337", "Highest Security"],
    explorerUrl: "https://etherscan.io",
    status: "live",
    transactionSpeed: "~12 sec",
    avgFee: "$2-10",
  },
  {
    id: "arbitrum",
    name: "Arbitrum One",
    shortName: "ARB",
    category: "evm",
    chainId: 42161,
    caip2: "eip155:42161",
    color: "#28A0F0",
    icon: "arbitrum",
    description: "Leading Ethereum L2 with optimistic rollups. High throughput and low fees with full EVM compatibility.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Optimistic rollup", "High throughput", "DeFi hub"],
    explorerUrl: "https://arbiscan.io",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },
  {
    id: "optimism",
    name: "Optimism",
    shortName: "OP",
    category: "evm",
    chainId: 10,
    caip2: "eip155:10",
    color: "#FF0420",
    icon: "optimism",
    description: "Ethereum L2 using optimistic rollups. Powers the Superchain ecosystem with fast, cheap transactions.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0x01bFF41798a0BcF287b996046Ca68b395DbC1071", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "OP Stack", "Superchain", "Low fees"],
    explorerUrl: "https://optimistic.etherscan.io",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },
  {
    id: "polygon",
    name: "Polygon",
    shortName: "POL",
    category: "evm",
    chainId: 137,
    caip2: "eip155:137",
    color: "#8247E5",
    icon: "polygon",
    description: "Popular EVM sidechain with high throughput. Large ecosystem and widespread adoption.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "High throughput", "Large ecosystem", "zkEVM"],
    explorerUrl: "https://polygonscan.com",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },
  {
    id: "ink",
    name: "Ink",
    shortName: "INK",
    category: "evm",
    chainId: 57073,
    caip2: "eip155:57073",
    color: "#7B3FE4",
    icon: "ink",
    description: "Kraken's L2 chain built on Optimism. Institutional-grade security with CEX integration.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0x0200C29006150606B650577BBE7B6248F58470c1", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Kraken ecosystem", "Institutional grade", "OP Stack"],
    explorerUrl: "https://explorer.inkonchain.com",
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
    caip2: "eip155:80094",
    color: "#FF6B00",
    icon: "berachain",
    description: "Novel proof-of-liquidity consensus chain. Built for DeFi with innovative tokenomics.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Proof of Liquidity", "Native DeFi", "LayerZero bridge"],
    explorerUrl: "https://berascan.com",
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
    caip2: "eip155:130",
    color: "#FF007A",
    icon: "unichain",
    description: "Uniswap's dedicated L2 chain. Optimized for trading with MEV protection and fast finality.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0x9151434b16b9763660705744891fA906F660EcC5", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "MEV protection", "Fast swaps", "Uniswap native"],
    explorerUrl: "https://uniscan.xyz",
    status: "live",
    transactionSpeed: "~1 sec",
    avgFee: "<$0.01",
  },
  {
    id: "mantle",
    name: "Mantle",
    shortName: "MNT",
    category: "evm",
    chainId: 5000,
    caip2: "eip155:5000",
    color: "#000000",
    icon: "mantle",
    description: "Modular L2 built on Ethereum with data availability powered by EigenDA. Optimized for low gas fees.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "EigenDA", "Modular design", "Low fees"],
    explorerUrl: "https://mantlescan.xyz",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },
  {
    id: "plasma",
    name: "Plasma",
    shortName: "PLASMA",
    category: "evm",
    chainId: 9745,
    caip2: "eip155:9745",
    color: "#00D4AA",
    icon: "plasma",
    description: "High-performance EVM chain with USDT0 support via LayerZero OFT standard.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "LayerZero OFT", "High performance", "Low fees"],
    explorerUrl: "https://explorer.plasma.io",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },
  {
    id: "sei",
    name: "Sei",
    shortName: "SEI",
    category: "evm",
    chainId: 1329,
    caip2: "eip155:1329",
    color: "#9B1C2E",
    icon: "sei",
    description: "The fastest EVM chain with parallelized execution. Built for high-frequency trading and DeFi.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0x9151434b16b9763660705744891fA906F660EcC5", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Parallelized EVM", "380ms finality", "Trading optimized"],
    explorerUrl: "https://seitrace.com",
    status: "live",
    transactionSpeed: "~380ms",
    avgFee: "<$0.01",
  },
  {
    id: "conflux",
    name: "Conflux eSpace",
    shortName: "CFX",
    category: "evm",
    chainId: 1030,
    caip2: "eip155:1030",
    color: "#1A1A2E",
    icon: "conflux",
    description: "Cross-border chain with regulatory compliance. Strong presence in Asia Pacific markets.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Tree-Graph consensus", "Cross-border", "Asia markets"],
    explorerUrl: "https://evm.confluxscan.org",
    status: "live",
    transactionSpeed: "~5 sec",
    avgFee: "<$0.01",
  },
  {
    id: "monad",
    name: "Monad",
    shortName: "MON",
    category: "evm",
    chainId: 143,
    caip2: "eip155:143",
    color: "#836EF9",
    icon: "monad",
    description: "Ultra-high performance EVM chain with parallel execution and 10,000 TPS capability.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "10,000 TPS", "Parallel execution", "1s finality"],
    explorerUrl: "https://explorer.monad.xyz",
    status: "live",
    transactionSpeed: "~1 sec",
    avgFee: "<$0.01",
  },
  {
    id: "flare",
    name: "Flare",
    shortName: "FLR",
    category: "evm",
    chainId: 14,
    caip2: "eip155:14",
    color: "#E42058",
    icon: "flare",
    description: "Data-focused blockchain providing decentralized oracle infrastructure for cross-chain applications.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0xe7cd86e13AC4309349F30B3435a9d337750fC82D", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "FTSO oracles", "State connector", "Cross-chain data"],
    explorerUrl: "https://flarescan.com",
    status: "live",
    transactionSpeed: "~3 sec",
    avgFee: "<$0.01",
  },
  {
    id: "rootstock",
    name: "Rootstock",
    shortName: "RSK",
    category: "evm",
    chainId: 30,
    caip2: "eip155:30",
    color: "#00B520",
    icon: "rootstock",
    description: "Bitcoin-secured smart contract platform. EVM compatibility with Bitcoin's hash power security.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0x779dED0C9e1022225F8e0630b35A9B54Be713736", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Bitcoin secured", "Merge mining", "BTC ecosystem"],
    explorerUrl: "https://explorer.rootstock.io",
    status: "live",
    transactionSpeed: "~30 sec",
    avgFee: "<$0.05",
  },
  {
    id: "xlayer",
    name: "XLayer",
    shortName: "XL",
    category: "evm",
    chainId: 196,
    caip2: "eip155:196",
    color: "#1E1E1E",
    icon: "xlayer",
    description: "OKX's zkEVM L2 chain. Combines ZK-proof security with EVM compatibility and OKX ecosystem.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "zkEVM", "OKX ecosystem", "ZK security"],
    explorerUrl: "https://www.okx.com/explorer/xlayer",
    status: "live",
    transactionSpeed: "~3 sec",
    avgFee: "<$0.01",
  },
  {
    id: "stable",
    name: "Stable",
    shortName: "STB",
    category: "evm",
    chainId: 988,
    caip2: "eip155:988",
    color: "#2563EB",
    icon: "stable",
    description: "Purpose-built chain optimized for stablecoin transactions with predictable fees.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Stablecoin optimized", "Predictable fees", "Fast settlement"],
    explorerUrl: "https://explorer.stable.io",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },
  {
    id: "hyperevm",
    name: "HyperEVM",
    shortName: "HYPER",
    category: "evm",
    chainId: 999,
    caip2: "eip155:999",
    color: "#5AE4A8",
    icon: "hyperevm",
    description: "Hyperliquid's EVM chain bringing DeFi-grade performance to general smart contract execution.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Hyperliquid ecosystem", "DeFi performance", "Low latency"],
    explorerUrl: "https://explorer.hyperliquid.xyz",
    status: "live",
    transactionSpeed: "~1 sec",
    avgFee: "<$0.01",
  },
  {
    id: "megaeth",
    name: "MegaETH",
    shortName: "MEGA",
    category: "evm",
    chainId: 4326,
    caip2: "eip155:4326",
    color: "#FF4D6A",
    icon: "megaeth",
    description: "Real-time blockchain with sub-millisecond latency. Designed for high-frequency applications.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "Sub-ms latency", "100k TPS", "Real-time execution"],
    explorerUrl: "https://explorer.megaeth.com",
    status: "live",
    transactionSpeed: "<1 sec",
    avgFee: "<$0.001",
  },
  {
    id: "corn",
    name: "Corn",
    shortName: "CORN",
    category: "evm",
    chainId: 21000000,
    caip2: "eip155:21000000",
    color: "#F5A623",
    icon: "corn",
    description: "Bitcoin-powered Ethereum L2 using BTC as gas. Combines Bitcoin economics with EVM flexibility.",
    tokens: [
      { symbol: "USDT0", name: "Tether USD", type: "eip3009", address: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb", gasless: true },
    ],
    features: ["EIP-3009 Gasless", "BTC gas token", "Bitcoin-powered", "EVM compatible"],
    explorerUrl: "https://cornscan.io",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },

  // =========================================================================
  // Non-EVM Chains
  // =========================================================================
  {
    id: "solana",
    name: "Solana",
    shortName: "SOL",
    category: "svm",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    color: "#9945FF",
    icon: "solana",
    description: "High-performance L1 with sub-second finality. Massive throughput for payments and trading.",
    tokens: [
      { symbol: "USDC", name: "USD Coin", type: "spl", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
    ],
    features: ["Sub-second finality", "65,000 TPS", "Low fees", "Large ecosystem"],
    explorerUrl: "https://solscan.io",
    status: "live",
    transactionSpeed: "~400ms",
    avgFee: "<$0.001",
  },
  {
    id: "ton",
    name: "TON",
    shortName: "TON",
    category: "ton",
    caip2: "ton:mainnet",
    color: "#0098EA",
    icon: "ton",
    description: "Telegram's blockchain with 950M+ user reach. Seamless Telegram integration for social payments.",
    tokens: [
      { symbol: "USDT", name: "Tether USD (Jetton)", type: "jetton", address: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs" },
    ],
    features: ["Telegram integration", "950M+ users", "Fast finality", "Jetton standard"],
    explorerUrl: "https://tonscan.org",
    status: "live",
    transactionSpeed: "~5 sec",
    avgFee: "<$0.01",
  },
  {
    id: "tron",
    name: "TRON",
    shortName: "TRX",
    category: "tron",
    caip2: "tron:mainnet",
    color: "#FF0000",
    icon: "tron",
    description: "High-throughput chain with massive USDT adoption. #1 chain for stablecoin transfers globally.",
    tokens: [
      { symbol: "USDT", name: "Tether USD (TRC-20)", type: "trc20", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
    ],
    features: ["#1 USDT chain", "High throughput", "Low fees", "Global adoption"],
    explorerUrl: "https://tronscan.org",
    status: "live",
    transactionSpeed: "~3 sec",
    avgFee: "<$1",
  },
  {
    id: "near",
    name: "NEAR",
    shortName: "NEAR",
    category: "near",
    caip2: "near:mainnet",
    color: "#00EC97",
    icon: "near",
    description: "Sharded L1 with human-readable accounts. Developer-friendly with JavaScript SDK and low fees.",
    tokens: [
      { symbol: "USDT", name: "Tether USD (NEP-141)", type: "nep141", address: "usdt.tether-token.near" },
    ],
    features: ["Human-readable accounts", "Sharded design", "JS SDK", "Named accounts"],
    explorerUrl: "https://nearblocks.io",
    status: "live",
    transactionSpeed: "~2 sec",
    avgFee: "<$0.01",
  },
  {
    id: "aptos",
    name: "Aptos",
    shortName: "APT",
    category: "aptos",
    caip2: "aptos:1",
    color: "#2DD8A3",
    icon: "aptos",
    description: "Move-based L1 with parallel execution. High throughput with strong safety guarantees from Move language.",
    tokens: [
      { symbol: "USDT", name: "Tether USD", type: "fungible-asset", address: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb" },
    ],
    features: ["Move language", "Parallel execution", "160k TPS", "Strong safety"],
    explorerUrl: "https://aptoscan.com",
    status: "live",
    transactionSpeed: "~1 sec",
    avgFee: "<$0.01",
  },
  {
    id: "tezos",
    name: "Tezos",
    shortName: "XTZ",
    category: "tezos",
    caip2: "tezos:NetXdQprcVkpaWU",
    color: "#2C7DF7",
    icon: "tezos",
    description: "Self-amending blockchain with on-chain governance. Formal verification and institutional adoption.",
    tokens: [
      { symbol: "USDt", name: "Tether USD (FA2)", type: "fa2", address: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o" },
    ],
    features: ["On-chain governance", "Formal verification", "Self-amending", "Energy efficient"],
    explorerUrl: "https://tzkt.io",
    status: "live",
    transactionSpeed: "~30 sec",
    avgFee: "<$0.01",
  },
  {
    id: "polkadot",
    name: "Polkadot Asset Hub",
    shortName: "DOT",
    category: "polkadot",
    caip2: "polkadot:68d56f15f85d3136970ec16946040bc1",
    color: "#E6007A",
    icon: "polkadot",
    description: "Polkadot's system parachain for asset management. Native multi-chain interoperability via XCM.",
    tokens: [
      { symbol: "USDT", name: "Tether USD", type: "asset-hub" },
    ],
    features: ["XCM cross-chain", "Shared security", "Parachain ecosystem", "Asset management"],
    explorerUrl: "https://assethub-polkadot.subscan.io",
    status: "live",
    transactionSpeed: "~12 sec",
    avgFee: "<$0.01",
  },
  {
    id: "stacks",
    name: "Stacks",
    shortName: "STX",
    category: "stacks",
    caip2: "stacks:1",
    color: "#5546FF",
    icon: "stacks",
    description: "Bitcoin L2 bringing smart contracts to BTC. Secured by Bitcoin's proof-of-work via Proof of Transfer.",
    tokens: [
      { symbol: "sUSDT", name: "Stacks USDT", type: "sip010", address: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-usdt" },
    ],
    features: ["Bitcoin secured", "Proof of Transfer", "Clarity language", "BTC finality"],
    explorerUrl: "https://explorer.hiro.so",
    status: "live",
    transactionSpeed: "~10 min",
    avgFee: "<$0.50",
  },
  {
    id: "cosmos-noble",
    name: "Cosmos / Noble",
    shortName: "NOBLE",
    category: "cosmos",
    caip2: "cosmos:noble-1",
    color: "#6F7390",
    icon: "cosmos",
    description: "Native USDC issuance chain in the Cosmos ecosystem. IBC-connected to 50+ Cosmos chains.",
    tokens: [
      { symbol: "USDC", name: "USD Coin (IBC)", type: "ibc" },
    ],
    features: ["IBC transfers", "50+ chains connected", "Native USDC", "Instant finality"],
    explorerUrl: "https://www.mintscan.io/noble",
    status: "live",
    transactionSpeed: "~6 sec",
    avgFee: "<$0.01",
  },
];

export const categories: { id: ChainCategory; name: string; description: string }[] = [
  {
    id: "evm",
    name: "EVM Chains",
    description: "19 Ethereum Virtual Machine compatible chains with USDT0 via LayerZero OFT",
  },
  {
    id: "svm",
    name: "Solana",
    description: "Solana Virtual Machine with high throughput and sub-second finality",
  },
  {
    id: "ton",
    name: "TON",
    description: "The Open Network with Telegram integration and 950M+ user reach",
  },
  {
    id: "tron",
    name: "TRON",
    description: "High-throughput chain optimized for stablecoin transfers globally",
  },
  {
    id: "near",
    name: "NEAR",
    description: "Sharded L1 with human-readable accounts and NEP-141 token standard",
  },
  {
    id: "aptos",
    name: "Aptos",
    description: "Move-based L1 with parallel execution and Fungible Asset standard",
  },
  {
    id: "tezos",
    name: "Tezos",
    description: "Self-amending blockchain with FA2 token standard and formal verification",
  },
  {
    id: "polkadot",
    name: "Polkadot",
    description: "Multi-chain ecosystem with Asset Hub for cross-chain token transfers",
  },
  {
    id: "stacks",
    name: "Stacks",
    description: "Bitcoin L2 with Clarity smart contracts and SIP-010 token standard",
  },
  {
    id: "cosmos",
    name: "Cosmos",
    description: "IBC-connected ecosystem with native USDC issuance on Noble",
  },
];

export const features = [
  {
    id: "gasless",
    name: "Gasless Transactions",
    description: "EIP-3009 enables gasless USDT0 transfers on all EVM chains",
    icon: "gasless",
  },
  {
    id: "bridge",
    name: "Cross-Chain Bridge",
    description: "LayerZero OFT standard enables seamless USDT0 bridging across EVM chains",
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
  {
    id: "mcp",
    name: "AI Agent Payments",
    description: "Model Context Protocol integration for autonomous AI agent transactions",
    icon: "ai",
  },
  {
    id: "multichain",
    name: "Universal Coverage",
    description: "50 networks across 10 blockchain ecosystems with unified API",
    icon: "multichain",
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

export function getEvmChains(): Chain[] {
  return chains.filter((chain) => chain.category === "evm");
}

export function getNonEvmChains(): Chain[] {
  return chains.filter((chain) => chain.category !== "evm");
}
