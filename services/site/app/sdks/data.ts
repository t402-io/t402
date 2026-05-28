/**
 * SDK Data for t402
 */

export interface SDK {
  id: string;
  name: string;
  language: string;
  description: string;
  icon: string;
  installCommand: string;
  packageManager?: string;
  version: string;
  docsUrl: string;
  githubUrl: string;
  features: string[];
  codeExample: string;
  color: string;
}

export interface Package {
  name: string;
  description: string;
  npmPackage?: string;
  features: string[];
  badge?: "new" | "beta" | "deprecated";
}

export const sdks: SDK[] = [
  {
    id: "typescript",
    name: "TypeScript",
    language: "TypeScript / JavaScript",
    description:
      "Full-featured SDK for Node.js and browser environments. Includes server middleware, client utilities, and framework integrations for 13 blockchain families.",
    icon: "typescript",
    installCommand: "npm install @t402/core",
    packageManager: "npm",
    version: "2.8.0",
    docsUrl: "https://docs.t402.io/sdks/typescript",
    githubUrl: "https://github.com/t402-io/t402/tree/main/sdks/typescript",
    features: [
      "Server & Client support",
      "Express, Hono, Fastify, Next.js middleware",
      "React & Vue components",
      "14 chain mechanisms (EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, Cosmos, Stellar, BTC, Lightning, Spark)",
      "MCP + A2A agent transports",
      "WDK gasless, bridge & multisig",
      "TypeScript-first design",
    ],
    codeExample: `import { paymentMiddleware } from "@t402/express";
import { ExactEvmServer } from "@t402/evm/exact/server";

app.use(paymentMiddleware({
  "GET /api/data": {
    price: "$0.01",
    network: "eip155:8453",
    resource: "Premium API access",
    schemes: [
      new ExactEvmServer({
        payTo: "0x...",
      }),
    ],
  },
}));`,
    color: "#3178C6",
  },
  {
    id: "python",
    name: "Python",
    language: "Python 3.10+",
    description:
      "Python SDK for server-side integrations. Works with Flask, FastAPI, Django, and other frameworks with full EVM and Solana support.",
    icon: "python",
    installCommand: "pip install t402",
    packageManager: "pip",
    version: "1.12.1",
    docsUrl: "https://docs.t402.io/sdks/python",
    githubUrl: "https://github.com/t402-io/t402/tree/main/sdks/python",
    features: [
      "Flask & FastAPI middleware",
      "Django integration",
      "Async/await support",
      "Type hints with Pydantic",
      "EVM, Solana, TON, TRON support",
      "Facilitator client",
    ],
    codeExample: `from t402 import PaymentMiddleware
from t402.schemes import exact

middleware = PaymentMiddleware({
    "GET /api/data": {
        "price": "$0.01",
        "network": "eip155:8453",
        "accepts": [
            exact.evm(
                pay_to="0x...",
                network="eip155:8453",
            ),
        ],
    },
})

app = middleware(app)`,
    color: "#3776AB",
  },
  {
    id: "go",
    name: "Go",
    language: "Go 1.24+",
    description:
      "High-performance Go SDK for building payment-enabled APIs and services. Supports 13 blockchain families with the facilitator service built on it.",
    icon: "go",
    installCommand: "go get github.com/t402-io/t402/sdks/go",
    packageManager: "go",
    version: "1.12.1",
    docsUrl: "https://docs.t402.io/sdks/go",
    githubUrl: "https://github.com/t402-io/t402/tree/main/sdks/go",
    features: [
      "net/http compatible",
      "Gin middleware",
      "10 chain mechanisms",
      "Context-based API",
      "MCP server support",
      "Facilitator reference impl",
    ],
    codeExample: `import (
    "github.com/t402-io/t402/sdks/go"
    "github.com/t402-io/t402/sdks/go/mechanisms/evm"
)

middleware := t402.NewMiddleware(t402.Config{
    Routes: map[string]t402.Route{
        "GET /api/data": {
            Price:   "$0.01",
            Network: "eip155:8453",
            Schemes: []t402.Scheme{
                evm.Exact("0x...", "eip155:8453"),
            },
        },
    },
})

http.Handle("/", middleware(handler))`,
    color: "#00ADD8",
  },
  {
    id: "java",
    name: "Java",
    language: "Java 21+",
    description:
      "Enterprise-ready Java SDK with Spring Boot integration. Supports 13 blockchain families with annotation-based payment configuration.",
    icon: "java",
    installCommand: "io.t402:t402:1.12.1",
    packageManager: "maven",
    version: "1.12.1",
    docsUrl: "https://docs.t402.io/sdks/java",
    githubUrl: "https://github.com/t402-io/t402/tree/main/sdks/java",
    features: [
      "Spring Boot auto-config",
      "Annotation-based payments",
      "WebFlux reactive support",
      "Kotlin coroutines",
      "EVM chain support",
      "Enterprise-grade security",
    ],
    codeExample: `import io.t402.spring.EnableT402;
import io.t402.spring.T402Payment;

@EnableT402
@SpringBootApplication
public class App {
    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
    }
}

@RestController
public class ApiController {
    @T402Payment(amount = "0.01", network = "eip155:8453")
    @GetMapping("/api/data")
    public Map<String, String> getData() {
        return Map.of("data", "Premium content");
    }
}`,
    color: "#ED8B00",
  },
];

export const typescriptPackages: Package[] = [
  // Core
  {
    name: "@t402/core",
    npmPackage: "@t402/core",
    description: "Core protocol types, utilities, and base functionality",
    features: ["Protocol types", "Payment verification", "Signature handling", "Utility functions"],
  },
  {
    name: "@t402/extensions",
    npmPackage: "@t402/extensions",
    description: "Protocol extensions for advanced payment features",
    features: ["Resource info", "Receipt extensions", "Custom headers", "Extension registry"],
    badge: "new",
  },
  // Chain mechanisms
  {
    name: "@t402/evm-core",
    npmPackage: "@t402/evm-core",
    description: "Shared EVM utilities for chain mechanism packages",
    features: ["ABI encoding", "Address validation", "Chain config", "Token registry"],
  },
  {
    name: "@t402/evm",
    npmPackage: "@t402/evm",
    description: "EVM chain support — 19 USDT0 networks + legacy USDT chains",
    features: ["EIP-3009 gasless", "19 USDT0 chains", "Legacy USDT support", "Viem integration"],
  },
  {
    name: "@t402/svm",
    npmPackage: "@t402/svm",
    description: "Solana Virtual Machine support with SPL tokens",
    features: ["SPL token payments", "Transaction building", "Wallet adapters", "V1/V2 protocol"],
  },
  {
    name: "@t402/ton",
    npmPackage: "@t402/ton",
    description: "TON blockchain support with Jetton transfers",
    features: ["Jetton transfers", "USDT payments", "TON Connect", "Mainnet & Testnet"],
  },
  {
    name: "@t402/tron",
    npmPackage: "@t402/tron",
    description: "TRON blockchain support with TRC-20 tokens",
    features: ["TRC20 payments", "USDT support", "TronWeb integration", "Energy optimization"],
  },
  {
    name: "@t402/near",
    npmPackage: "@t402/near",
    description: "NEAR Protocol support with NEP-141 fungible tokens",
    features: ["NEP-141 tokens", "USDT via usdt.tether-token.near", "Near-API-JS", "Mainnet & Testnet"],
    badge: "new",
  },
  {
    name: "@t402/aptos",
    npmPackage: "@t402/aptos",
    description: "Aptos blockchain support with Fungible Asset standard",
    features: ["Fungible Asset", "USDT support", "Aptos SDK", "Mainnet & Testnet"],
    badge: "new",
  },
  {
    name: "@t402/tezos",
    npmPackage: "@t402/tezos",
    description: "Tezos blockchain support with FA2 token standard",
    features: ["FA2 tokens", "USDt support", "Taquito SDK", "Mainnet & Ghostnet"],
    badge: "new",
  },
  {
    name: "@t402/polkadot",
    npmPackage: "@t402/polkadot",
    description: "Polkadot Asset Hub support for multi-chain DOT ecosystem",
    features: ["Asset Hub USDT", "Polkadot.js", "XCM transfers", "Westend testnet"],
    badge: "new",
  },
  {
    name: "@t402/stacks",
    npmPackage: "@t402/stacks",
    description: "Stacks (Bitcoin L2) support with SIP-010 tokens",
    features: ["SIP-010 tokens", "Bitcoin settlement", "Stacks.js", "Mainnet & Testnet"],
    badge: "new",
  },
  {
    name: "@t402/cosmos",
    npmPackage: "@t402/cosmos",
    description: "Cosmos (Noble) support for native USDC transfers",
    features: ["Noble USDC", "IBC transfers", "Cosmos SDK", "Mainnet & Testnet"],
    badge: "new",
  },
  {
    name: "@t402/btc",
    npmPackage: "@t402/btc",
    description: "Bitcoin and Lightning Network support for BTC payments",
    features: ["Bitcoin L1", "Lightning Network", "bitcoinjs-lib", "On-chain & Off-chain"],
    badge: "new",
  },
  // HTTP middleware
  {
    name: "@t402/express",
    npmPackage: "@t402/express",
    description: "Express.js middleware for payment-protected APIs",
    features: ["Route protection", "Paywall UI", "Settlement handling", "Error recovery"],
  },
  {
    name: "@t402/hono",
    npmPackage: "@t402/hono",
    description: "Hono middleware for lightweight payment APIs",
    features: ["Edge runtime", "Cloudflare Workers", "Bun support", "Fast & lightweight"],
  },
  {
    name: "@t402/fastify",
    npmPackage: "@t402/fastify",
    description: "Fastify plugin for high-performance payment APIs",
    features: ["Schema validation", "Fastify hooks", "TypeBox types", "High throughput"],
    badge: "new",
  },
  {
    name: "@t402/next",
    npmPackage: "@t402/next",
    description: "Next.js integration with App Router support",
    features: ["Server actions", "API routes", "Middleware", "React components"],
  },
  // Client libraries
  {
    name: "@t402/fetch",
    npmPackage: "@t402/fetch",
    description: "Fetch wrapper with automatic payment handling",
    features: ["Auto-retry on 402", "Payment injection", "Type-safe", "Browser & Node"],
  },
  {
    name: "@t402/axios",
    npmPackage: "@t402/axios",
    description: "Axios interceptor for automatic payments",
    features: ["Request interceptor", "Response handling", "Error recovery", "Type-safe"],
  },
  // UI components
  {
    name: "@t402/paywall",
    npmPackage: "@t402/paywall",
    description: "Drop-in payment UI components (framework-agnostic)",
    features: ["Web components", "Wallet connection", "Payment flow", "Customizable themes"],
  },
  {
    name: "@t402/react",
    npmPackage: "@t402/react",
    description: "React hooks and components for payment UIs",
    features: ["usePayment hook", "PaymentGate component", "Wallet connect", "SSR safe"],
    badge: "new",
  },
  {
    name: "@t402/vue",
    npmPackage: "@t402/vue",
    description: "Vue 3 composables and components for payments",
    features: ["usePayment composable", "PaymentGate component", "Pinia integration", "SSR safe"],
    badge: "new",
  },
  // Agent transports
  {
    name: "@t402/mcp",
    npmPackage: "@t402/mcp",
    description: "Model Context Protocol server for AI agent payments",
    features: ["MCP tools", "Budget policies", "Autonomous payments", "Claude integration"],
  },
  {
    name: "@t402/a2a",
    npmPackage: "@t402/a2a",
    description: "Agent-to-Agent (A2A) transport for inter-agent commerce",
    features: ["A2A protocol", "Task-based payments", "Agent discovery", "Service negotiation"],
    badge: "new",
  },
  // UI components (continued)
  {
    name: "@t402/react-native",
    npmPackage: "@t402/react-native",
    description: "React Native SDK for mobile payment integration",
    features: ["React Native", "Mobile payments", "iOS & Android", "Hooks & components"],
    badge: "new",
  },
  // WDK integrations
  {
    name: "@t402/wdk",
    npmPackage: "@t402/wdk",
    description: "Wallet abstraction layer for unified self-custodial accounts",
    features: ["Multi-chain wallets", "Balance aggregation", "Seed phrase support", "T402 signers"],
  },
  {
    name: "@t402/wdk-gasless",
    npmPackage: "@t402/wdk-gasless",
    description: "Gasless USDT0 payments via EIP-3009 and ERC-4337",
    features: ["Zero gas fees", "Permit signatures", "Account abstraction", "WDK integration"],
  },
  {
    name: "@t402/wdk-bridge",
    npmPackage: "@t402/wdk-bridge",
    description: "Cross-chain USDT0 bridging via LayerZero OFT",
    features: ["Multi-chain bridge", "Auto-routing", "Delivery tracking", "Route strategies"],
  },
  {
    name: "@t402/wdk-multisig",
    npmPackage: "@t402/wdk-multisig",
    description: "Safe multi-signature wallet integration",
    features: ["Safe protocol", "M-of-N signing", "Transaction queue", "Module support"],
    badge: "new",
  },
  {
    name: "@t402/wdk-protocol",
    npmPackage: "@t402/wdk-protocol",
    description: "T402 payment protocol bindings for WDK-compatible wallet apps",
    features: ["WDK integration", "Payment protocol", "Wallet apps", "Auto-signing"],
    badge: "new",
  },
  {
    name: "@t402/wdk-defi",
    npmPackage: "@t402/wdk-defi",
    description: "DeFi integrations for WDK including swaps and liquidity",
    features: ["Token swaps", "Liquidity pools", "DeFi protocols", "WDK wallets"],
    badge: "new",
  },
  {
    name: "@t402/wdk-ton",
    npmPackage: "@t402/wdk-ton",
    description: "Server-side TON wallet management with @ton/walletkit",
    features: ["TON wallets", "Server-side", "walletkit", "Key management"],
    badge: "new",
  },
  {
    name: "@t402/wdk-ton-gasless",
    npmPackage: "@t402/wdk-ton-gasless",
    description: "Gasless USDT0 payments on TON via WDK abstraction",
    features: ["TON gasless", "USDT0 payments", "WDK integration", "No gas needed"],
    badge: "new",
  },
  {
    name: "@t402/wdk-tron-gasfree",
    npmPackage: "@t402/wdk-tron-gasfree",
    description: "Gas-free USDT payments on TRON via WDK abstraction",
    features: ["TRON gas-free", "USDT payments", "WDK integration", "No energy needed"],
    badge: "new",
  },
  // CLI
  {
    name: "@t402/cli",
    npmPackage: "@t402/cli",
    description: "Command-line interface for T402 operations",
    features: ["Wallet management", "Send payments", "Multi-chain", "Configuration"],
  },
  {
    name: "@t402/stellar",
    npmPackage: "@t402/stellar",
    description: "Stellar blockchain support with Soroban SEP-41 transfers",
    features: ["Soroban contracts", "USDC payments", "Ed25519 signatures", "Pubnet & Testnet"],
    badge: "new",
  },
  {
    name: "@t402/spark",
    npmPackage: "@t402/spark",
    description: "Spark (Bitcoin L2) support with Lightning Network integration",
    features: ["Instant BTC payments", "Lightning routing", "Zero fees", "Mainnet & Testnet"],
    badge: "new",
  },
  // New packages from v2.8.0
  {
    name: "@t402/policy",
    npmPackage: "@t402/policy",
    description: "Payment policy engine for AI agent spending guardrails",
    features: ["Spending limits", "Recipient allowlists", "Rate limiting", "Custom rules"],
    badge: "new",
  },
  {
    name: "@t402/observability",
    npmPackage: "@t402/observability",
    description: "Payment event tracking, metrics, and Prometheus export",
    features: ["Event collection", "Flow tracing", "Prometheus metrics", "Ring buffer"],
    badge: "new",
  },
  {
    name: "@t402/facilitator-embedded",
    npmPackage: "@t402/facilitator-embedded",
    description: "In-process facilitator for simplified deployments",
    features: ["No external service", "Scheme routing", "Lifecycle events", "Development mode"],
    badge: "new",
  },
  {
    name: "@t402/erc8004",
    npmPackage: "@t402/erc8004",
    description: "ERC-8004 agent identity and reputation registry",
    features: ["Agent identity", "Reputation scoring", "Wallet verification", "On-chain registry"],
  },
];

export const advancedPackages: Package[] = [];

export const supportedChains = [
  // EVM - USDT0 chains (live)
  { name: "Ethereum", id: "ethereum", color: "#627EEA" },
  { name: "Arbitrum", id: "arbitrum", color: "#28A0F0" },
  { name: "Base", id: "base", color: "#0052FF" },
  { name: "Optimism", id: "optimism", color: "#FF0420" },
  { name: "Polygon", id: "polygon", color: "#8247E5" },
  { name: "Ink", id: "ink", color: "#7B3FE4" },
  { name: "Berachain", id: "berachain", color: "#FF6B00" },
  { name: "Unichain", id: "unichain", color: "#FF007A" },
  { name: "Mantle", id: "mantle", color: "#000000" },
  { name: "Sei", id: "sei", color: "#9B1C2E" },
  { name: "Conflux eSpace", id: "conflux", color: "#1A1A2E" },
  { name: "Flare", id: "flare", color: "#E42058" },
  { name: "Rootstock", id: "rootstock", color: "#00B520" },
  { name: "XLayer", id: "xlayer", color: "#1E1E1E" },
  { name: "Corn", id: "corn", color: "#F5A623" },
  // EVM - USDT0 chains (coming soon)
  { name: "Plasma", id: "plasma", color: "#00D4AA" },
  { name: "Monad", id: "monad", color: "#836EF9" },
  { name: "Stable", id: "stable", color: "#2563EB" },
  { name: "HyperEVM", id: "hyperevm", color: "#5AE4A8" },
  { name: "MegaETH", id: "megaeth", color: "#FF4D6A" },
  // Non-EVM chains (live)
  { name: "Solana", id: "solana", color: "#9945FF" },
  { name: "TON", id: "ton", color: "#0098EA" },
  { name: "TRON", id: "tron", color: "#FF0000" },
  { name: "NEAR", id: "near", color: "#00EC97" },
  { name: "Aptos", id: "aptos", color: "#2DD8A3" },
  { name: "Tezos", id: "tezos", color: "#2C7DF7" },
  { name: "Polkadot", id: "polkadot", color: "#E6007A" },
  { name: "Stacks", id: "stacks", color: "#5546FF" },
  { name: "Cosmos (Noble)", id: "cosmos", color: "#6F7390" },
  { name: "Stellar", id: "stellar", color: "#7C8CF8" },
  { name: "Bitcoin", id: "bitcoin", color: "#F7931A" },
  { name: "Lightning", id: "lightning", color: "#FFC107" },
  { name: "Spark", id: "spark", color: "#FF6B35" },
];
