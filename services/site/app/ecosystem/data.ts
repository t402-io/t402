/**
 * Ecosystem Data for t402
 */

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

  // Wallet Integration
  {
    id: "wdk",
    name: "@t402/wdk",
    category: "wallet",
    description:
      "Tether Wallet Development Kit integration for unified wallet management across chains.",
    language: "typescript",
    npmPackage: "@t402/wdk",
    features: ["Multi-chain wallets", "Tether WDK", "Unified API"],
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

  // AI Agents
  {
    id: "mcp",
    name: "@t402/mcp",
    category: "agents",
    description:
      "MCP server and A2A agent implementation for monetizing AI tools and agent-to-agent commerce.",
    language: "typescript",
    npmPackage: "@t402/mcp",
    features: ["MCP server", "A2A agent", "Tool monetization"],
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
];
