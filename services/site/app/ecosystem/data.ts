/**
 * Ecosystem Data for t402
 */

// ── Partner Directory ────────────────────────────────────────────────

export type PartnerCategory =
  | "infrastructure"
  | "defi"
  | "ai"
  | "services"
  | "wallets";

export const partnerCategoryLabels: Record<PartnerCategory, string> = {
  infrastructure: "Infrastructure",
  defi: "DeFi & Payments",
  ai: "AI & Agents",
  services: "Services",
  wallets: "Wallets & Identity",
};

export interface Partner {
  id: string;
  name: string;
  category: PartnerCategory;
  description: string;
  url: string;
  logo?: string;
  integration: string;
  badge?: "live" | "building" | "planned";
}

export const partners: Partner[] = [
  // Infrastructure
  {
    id: "usdt0",
    name: "USDT0",
    category: "infrastructure",
    description:
      "USDT0 cross-chain stablecoin (LayerZero OFT) — supported as a payment asset across 22+ chains. Not an official partnership; t402 supports the public USDT0 contracts.",
    url: "https://usdt0.to",
    integration: "Supported asset on EVM mechanisms (nominative use)",
    badge: "live",
  },
  {
    id: "layerzero",
    name: "LayerZero",
    category: "infrastructure",
    description:
      "Cross-chain messaging protocol powering USDT0 OFT bridging between t402-supported chains.",
    url: "https://layerzero.network",
    integration: "Bridge module for cross-chain settlements",
    badge: "live",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "infrastructure",
    description:
      "CDN, DDoS protection, and Tunnel for all t402 production services.",
    url: "https://cloudflare.com",
    integration: "Tunnel + DNS for 12 services",
    badge: "live",
  },
  // DeFi & Payments
  {
    id: "scan2pay",
    name: "Scan2Pay",
    category: "defi",
    description:
      "QR-code point-of-sale payment solution built on t402. Supports fiat on-ramp via OLPay.",
    url: "https://scan2pay.t402.io",
    integration: "Full t402 integration with facilitator",
    badge: "live",
  },
  {
    id: "uniswap",
    name: "Uniswap V3",
    category: "defi",
    description:
      "DEX integration for T402SwapPay — atomic swap-and-pay from any token to stablecoins.",
    url: "https://uniswap.org",
    integration: "SwapRouter in T402SwapPay.sol",
    badge: "live",
  },
  {
    id: "circle",
    name: "Circle / USDC",
    category: "defi",
    description:
      "USDC stablecoin supported as alternative payment asset across Ethereum, Base, Arbitrum, Polygon.",
    url: "https://circle.com",
    integration: "Supported asset on 6+ chains",
    badge: "live",
  },
  // AI & Agents
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    category: "ai",
    description:
      "MCP server integration for Claude — AI agents can discover and pay for t402-protected APIs.",
    url: "https://anthropic.com",
    integration: "@t402/mcp + @t402/payments-mcp",
    badge: "live",
  },
  {
    id: "openai",
    name: "OpenAI (Codex)",
    category: "ai",
    description:
      "MCP-compatible payments for Codex CLI agents via @t402/payments-mcp.",
    url: "https://openai.com",
    integration: "@t402/payments-mcp auto-detection",
    badge: "live",
  },
  {
    id: "google",
    name: "Google (Gemini)",
    category: "ai",
    description:
      "MCP-compatible payments for Gemini agents via @t402/payments-mcp.",
    url: "https://deepmind.google",
    integration: "@t402/payments-mcp auto-detection",
    badge: "live",
  },
  // Services
  {
    id: "sandbox",
    name: "T402 Sandbox",
    category: "services",
    description:
      "Interactive playground for testing t402 payment flows with a testnet facilitator.",
    url: "https://sandbox.t402.io",
    integration: "Native t402 service",
    badge: "live",
  },
  // Wallets & Identity
  {
    id: "moonpay",
    name: "MoonPay",
    category: "wallets",
    description:
      "Fiat on/off-ramp partner for buying USDT/USDC with credit card.",
    url: "https://moonpay.com",
    integration: "Fiat on/off-ramp",
    badge: "live",
  },
  {
    id: "pimlico",
    name: "Pimlico",
    category: "wallets",
    description:
      "ERC-4337 bundler and paymaster for account abstraction and gasless t402 payments.",
    url: "https://pimlico.io",
    integration: "ERC-4337 module in EVM mechanism",
    badge: "live",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    category: "defi",
    description:
      "Solana DEX aggregator for token swaps before t402 payments.",
    url: "https://jup.ag",
    integration: "Solana DEX aggregator",
    badge: "live",
  },
];

// ── Packages ─────────────────────────────────────────────────────────

export type EcosystemCategory =
  | "mechanisms"
  | "middleware"
  | "clients"
  | "ui"
  | "wallet"
  | "agents"
  | "tools";

export const categoryLabels: Record<EcosystemCategory, string> = {
  mechanisms: "Chain Mechanisms",
  middleware: "HTTP Middleware",
  clients: "HTTP Clients",
  ui: "UI Components",
  wallet: "Wallet Integration",
  agents: "AI Agents",
  tools: "Developer Tools",
};

export interface EcosystemPackage {
  id: string;
  name: string;
  category: EcosystemCategory;
  description: string;
  language: "typescript" | "go" | "python" | "java";
  npmPackage?: string;
  features: string[];
  badge?: "new" | "beta" | "coming-soon";
}

export const packages: EcosystemPackage[] = [
  // Chain Mechanisms
  {
    id: "evm",
    name: "@t402/evm",
    category: "mechanisms",
    description:
      "EVM chain support for 19+ networks including Ethereum, Base, Arbitrum, and Optimism. EIP-3009 gasless transfers.",
    language: "typescript",
    npmPackage: "@t402/evm",
    features: ["19+ EVM chains", "EIP-3009", "Gasless", "USDT0 + USDT"],
  },
  {
    id: "evm-core",
    name: "@t402/evm-core",
    category: "mechanisms",
    description:
      "Shared EVM utilities including ABI encoding, signature verification, and chain configuration.",
    language: "typescript",
    npmPackage: "@t402/evm-core",
    features: ["ABI encoding", "Signature utils", "Chain config"],
  },
  {
    id: "svm",
    name: "@t402/svm",
    category: "mechanisms",
    description:
      "Solana support using SPL token transfers with Ed25519 signatures and recent blockhash replay protection.",
    language: "typescript",
    npmPackage: "@t402/svm",
    features: ["SPL tokens", "Ed25519", "Blockhash replay protection"],
  },
  {
    id: "ton",
    name: "@t402/ton",
    category: "mechanisms",
    description:
      "TON blockchain support for Jetton transfers with Ed25519 signatures and query_id replay protection.",
    language: "typescript",
    npmPackage: "@t402/ton",
    features: ["Jetton transfers", "Ed25519", "query_id protection"],
  },
  {
    id: "tron",
    name: "@t402/tron",
    category: "mechanisms",
    description:
      "TRON support for TRC-20 token transfers with ECDSA secp256k1 signatures and Protobuf nonce protection.",
    language: "typescript",
    npmPackage: "@t402/tron",
    features: ["TRC-20 tokens", "ECDSA", "Protobuf nonce"],
  },
  {
    id: "near",
    name: "@t402/near",
    category: "mechanisms",
    description:
      "NEAR Protocol support for NEP-141 fungible token transfers with Ed25519 signatures.",
    language: "typescript",
    npmPackage: "@t402/near",
    features: ["NEP-141 tokens", "Ed25519", "Named accounts"],
    badge: "new",
  },
  {
    id: "aptos",
    name: "@t402/aptos",
    category: "mechanisms",
    description:
      "Aptos support for Fungible Asset transfers with Ed25519 signatures and sequence number protection.",
    language: "typescript",
    npmPackage: "@t402/aptos",
    features: ["Fungible Assets", "Ed25519", "Sequence numbers"],
    badge: "new",
  },
  {
    id: "tezos",
    name: "@t402/tezos",
    category: "mechanisms",
    description:
      "Tezos support for FA2 token transfers with Ed25519/secp256k1 signatures.",
    language: "typescript",
    npmPackage: "@t402/tezos",
    features: ["FA2 tokens", "Ed25519/secp256k1", "Mainnet + Ghostnet"],
    badge: "new",
  },
  {
    id: "polkadot",
    name: "@t402/polkadot",
    category: "mechanisms",
    description:
      "Polkadot Asset Hub support for DOT-native asset transfers with Sr25519 signatures.",
    language: "typescript",
    npmPackage: "@t402/polkadot",
    features: ["Asset Hub", "Sr25519", "Polkadot + Westend"],
    badge: "new",
  },
  {
    id: "stacks",
    name: "@t402/stacks",
    category: "mechanisms",
    description:
      "Stacks (Bitcoin L2) support for SIP-010 fungible token transfers with secp256k1 signatures.",
    language: "typescript",
    npmPackage: "@t402/stacks",
    features: ["SIP-010 tokens", "secp256k1", "Bitcoin settlement"],
    badge: "new",
  },
  {
    id: "cosmos",
    name: "@t402/cosmos",
    category: "mechanisms",
    description:
      "Cosmos (Noble) support for native USDC transfers with IBC interoperability.",
    language: "typescript",
    npmPackage: "@t402/cosmos",
    features: ["Noble USDC", "IBC transfers", "Cosmos SDK"],
    badge: "new",
  },
  {
    id: "btc",
    name: "@t402/btc",
    category: "mechanisms",
    description:
      "Bitcoin and Lightning Network support for on-chain and off-chain BTC payments.",
    language: "typescript",
    npmPackage: "@t402/btc",
    features: ["Bitcoin L1", "Lightning Network", "bitcoinjs-lib"],
    badge: "new",
  },

  // HTTP Middleware
  {
    id: "express",
    name: "@t402/express",
    category: "middleware",
    description:
      "Express.js middleware for protecting routes with t402 payment requirements. Drop-in integration.",
    language: "typescript",
    npmPackage: "@t402/express",
    features: ["Route protection", "Auto-verification", "Error handling"],
  },
  {
    id: "hono",
    name: "@t402/hono",
    category: "middleware",
    description:
      "Hono middleware for edge-first payment gating. Works with Cloudflare Workers, Deno, and Bun.",
    language: "typescript",
    npmPackage: "@t402/hono",
    features: ["Edge-first", "Cloudflare Workers", "Bun/Deno"],
  },
  {
    id: "fastify",
    name: "@t402/fastify",
    category: "middleware",
    description:
      "Fastify plugin for high-performance payment-gated APIs with schema validation.",
    language: "typescript",
    npmPackage: "@t402/fastify",
    features: ["Schema validation", "High performance", "Plugin system"],
  },
  {
    id: "next",
    name: "@t402/next",
    category: "middleware",
    description:
      "Next.js integration for API routes and middleware-based payment gating in App Router.",
    language: "typescript",
    npmPackage: "@t402/next",
    features: ["App Router", "API routes", "Middleware"],
  },

  // HTTP Clients
  {
    id: "fetch",
    name: "@t402/fetch",
    category: "clients",
    description:
      "Fetch API wrapper that automatically handles 402 responses, signs payments, and retries requests.",
    language: "typescript",
    npmPackage: "@t402/fetch",
    features: ["Auto-retry", "Payment signing", "Fetch compatible"],
  },
  {
    id: "axios",
    name: "@t402/axios",
    category: "clients",
    description:
      "Axios interceptor that transparently handles 402 payment flows in existing HTTP clients.",
    language: "typescript",
    npmPackage: "@t402/axios",
    features: ["Interceptor pattern", "Transparent", "Drop-in"],
  },

  // UI Components
  {
    id: "paywall",
    name: "@t402/paywall",
    category: "ui",
    description:
      "Universal paywall UI component that renders payment prompts with wallet connection and chain selection.",
    language: "typescript",
    npmPackage: "@t402/paywall",
    features: ["Wallet connect", "Chain selection", "Customizable"],
  },
  {
    id: "react",
    name: "@t402/react",
    category: "ui",
    description:
      "React hooks and components for building custom payment UIs with t402 protocol support.",
    language: "typescript",
    npmPackage: "@t402/react",
    features: ["React hooks", "Components", "TypeScript"],
    badge: "new",
  },
  {
    id: "vue",
    name: "@t402/vue",
    category: "ui",
    description:
      "Vue 3 composables and components for integrating t402 payments into Vue applications.",
    language: "typescript",
    npmPackage: "@t402/vue",
    features: ["Composables", "Vue 3", "TypeScript"],
    badge: "new",
  },
  {
    id: "react-native",
    name: "@t402/react-native",
    category: "ui",
    description:
      "React Native SDK for building mobile payment flows on iOS and Android.",
    language: "typescript",
    npmPackage: "@t402/react-native",
    features: ["React Native", "iOS & Android", "Hooks"],
    badge: "new",
  },

  // Wallet Integration
  {
    id: "wdk",
    name: "@t402/wdk",
    category: "wallet",
    description:
      "Wallet abstraction layer for unified self-custodial account management across chains.",
    language: "typescript",
    npmPackage: "@t402/wdk",
    features: ["Multi-chain wallets", "Self-custodial", "Unified API"],
  },
  {
    id: "wdk-gasless",
    name: "@t402/wdk-gasless",
    category: "wallet",
    description:
      "ERC-4337 account abstraction for gasless payments. Users pay only in stablecoins.",
    language: "typescript",
    npmPackage: "@t402/wdk-gasless",
    features: ["ERC-4337", "Account abstraction", "No gas needed"],
    badge: "beta",
  },
  {
    id: "wdk-bridge",
    name: "@t402/wdk-bridge",
    category: "wallet",
    description:
      "LayerZero OFT bridging for cross-chain USDT0 transfers between supported networks.",
    language: "typescript",
    npmPackage: "@t402/wdk-bridge",
    features: ["LayerZero OFT", "Cross-chain", "USDT0"],
    badge: "beta",
  },
  {
    id: "wdk-multisig",
    name: "@t402/wdk-multisig",
    category: "wallet",
    description:
      "Safe multi-signature wallet support for enterprise payment approvals and treasury management.",
    language: "typescript",
    npmPackage: "@t402/wdk-multisig",
    features: ["Safe multisig", "Enterprise", "Treasury"],
    badge: "beta",
  },
  {
    id: "wdk-protocol",
    name: "@t402/wdk-protocol",
    category: "wallet",
    description:
      "T402 payment protocol bindings for WDK-compatible wallet applications.",
    language: "typescript",
    npmPackage: "@t402/wdk-protocol",
    features: ["WDK bindings", "Payment protocol", "Auto-signing"],
    badge: "new",
  },
  {
    id: "wdk-defi",
    name: "@t402/wdk-defi",
    category: "wallet",
    description:
      "DeFi integrations for WDK including token swaps and liquidity management.",
    language: "typescript",
    npmPackage: "@t402/wdk-defi",
    features: ["Token swaps", "Liquidity", "DeFi protocols"],
    badge: "new",
  },
  {
    id: "wdk-ton",
    name: "@t402/wdk-ton",
    category: "wallet",
    description:
      "Server-side TON wallet management with @ton/walletkit for T402.",
    language: "typescript",
    npmPackage: "@t402/wdk-ton",
    features: ["TON wallets", "Server-side", "walletkit"],
    badge: "new",
  },
  {
    id: "wdk-ton-gasless",
    name: "@t402/wdk-ton-gasless",
    category: "wallet",
    description:
      "Gasless USDT0 payments on TON blockchain via WDK wallet abstraction.",
    language: "typescript",
    npmPackage: "@t402/wdk-ton-gasless",
    features: ["TON gasless", "USDT0", "WDK"],
    badge: "new",
  },
  {
    id: "wdk-tron-gasfree",
    name: "@t402/wdk-tron-gasfree",
    category: "wallet",
    description:
      "Gas-free USDT payments on TRON blockchain via WDK wallet abstraction.",
    language: "typescript",
    npmPackage: "@t402/wdk-tron-gasfree",
    features: ["TRON gas-free", "USDT", "WDK"],
    badge: "new",
  },

  // AI Agents
  {
    id: "mcp",
    name: "@t402/mcp",
    category: "agents",
    description:
      "MCP server for monetizing AI tools with autonomous payment handling.",
    language: "typescript",
    npmPackage: "@t402/mcp",
    features: ["MCP server", "11 tools", "Tool monetization"],
    badge: "new",
  },
  {
    id: "a2a",
    name: "@t402/a2a",
    category: "agents",
    description:
      "Agent-to-Agent (A2A) transport for inter-agent service commerce and task-based payments.",
    language: "typescript",
    npmPackage: "@t402/a2a",
    features: ["A2A protocol", "Agent discovery", "Task payments"],
    badge: "new",
  },

  // Developer Tools
  {
    id: "cli",
    name: "@t402/cli",
    category: "tools",
    description:
      "Command-line tools for testing payment flows, generating configurations, and debugging.",
    language: "typescript",
    npmPackage: "@t402/cli",
    features: ["Payment testing", "Config generation", "Debugging"],
  },
  {
    id: "extensions",
    name: "@t402/extensions",
    category: "tools",
    description:
      "Protocol extensions for resource metadata, usage tracking, and custom payment schemes.",
    language: "typescript",
    npmPackage: "@t402/extensions",
    features: ["Resource metadata", "Usage tracking", "Custom schemes"],
  },
  // New in v2.8.0
  {
    id: "stellar",
    name: "@t402/stellar",
    category: "mechanisms",
    description: "Stellar blockchain support with Soroban SEP-41 USDC transfers.",
    language: "typescript",
    npmPackage: "@t402/stellar",
    features: ["Soroban contracts", "USDC", "Ed25519", "Pubnet & Testnet"],
    badge: "new",
  },
  {
    id: "spark",
    name: "@t402/spark",
    category: "mechanisms",
    description: "Spark (Bitcoin L2) with instant transfers and Lightning Network routing.",
    language: "typescript",
    npmPackage: "@t402/spark",
    features: ["Bitcoin L2", "Lightning", "Instant finality", "Zero fees"],
    badge: "new",
  },
  {
    id: "policy",
    name: "@t402/policy",
    category: "agents",
    description: "Payment policy engine for AI agent spending guardrails. Limits, allowlists, custom rules.",
    language: "typescript",
    npmPackage: "@t402/policy",
    features: ["Spending limits", "Allowlists", "Rate limiting", "Custom rules"],
    badge: "new",
  },
  {
    id: "observability",
    name: "@t402/observability",
    category: "tools",
    description: "Payment event tracking, flow tracing, and Prometheus metrics export.",
    language: "typescript",
    npmPackage: "@t402/observability",
    features: ["Event collection", "Flow tracing", "Prometheus", "Ring buffer"],
    badge: "new",
  },
  {
    id: "facilitator-embedded",
    name: "@t402/facilitator-embedded",
    category: "middleware",
    description: "In-process facilitator — no external service needed for development or small deployments.",
    language: "typescript",
    npmPackage: "@t402/facilitator-embedded",
    features: ["In-process", "Scheme routing", "Lifecycle events", "Dev mode"],
    badge: "new",
  },
  {
    id: "erc8004",
    name: "@t402/erc8004",
    category: "agents",
    description: "ERC-8004 on-chain agent identity and reputation registry.",
    language: "typescript",
    npmPackage: "@t402/erc8004",
    features: ["Agent identity", "Reputation", "Wallet verification", "On-chain"],
  },
  {
    id: "payments-mcp",
    name: "@t402/payments-mcp",
    category: "agents",
    description: "One-command MCP payment client for Claude, Codex, and Gemini.",
    language: "typescript",
    npmPackage: "@t402/payments-mcp",
    features: ["npx install", "Auto-configure", "32+ tools", "AI client detection"],
    badge: "new",
  },
];
