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
}

export const sdks: SDK[] = [
  {
    id: "typescript",
    name: "TypeScript",
    language: "TypeScript / JavaScript",
    description:
      "Full-featured SDK for Node.js and browser environments. Includes server middleware, client utilities, and framework integrations.",
    icon: "typescript",
    installCommand: "npm install @t402/core",
    packageManager: "npm",
    version: "2.0.0",
    docsUrl: "https://docs.t402.io/sdks/typescript",
    githubUrl: "https://github.com/t402-io/t402/tree/main/typescript",
    features: [
      "Server & Client support",
      "Express, Hono, Fastify middleware",
      "Next.js integration",
      "React hooks & components",
      "EVM, Solana, TON, TRON support",
      "TypeScript-first design",
    ],
    codeExample: `import { paymentMiddleware } from "@t402/core";
import { evm } from "@t402/evm";

app.use(paymentMiddleware({
  "GET /api/data": {
    price: "$0.01",
    network: "base",
    resource: "Premium API access",
    accepts: [
      evm({
        address: "0x...",
        network: "base",
      }),
    ],
  },
}));`,
    color: "#3178C6",
  },
  {
    id: "python",
    name: "Python",
    language: "Python 3.8+",
    description:
      "Python SDK for server-side integrations. Works with Flask, FastAPI, Django, and other frameworks.",
    icon: "python",
    installCommand: "pip install t402",
    packageManager: "pip",
    version: "2.0.0",
    docsUrl: "https://docs.t402.io/sdks/python",
    githubUrl: "https://github.com/t402-io/t402/tree/main/python",
    features: [
      "Flask & FastAPI middleware",
      "Django integration",
      "Async/await support",
      "Type hints included",
      "EVM & Solana support",
      "Facilitator client",
    ],
    codeExample: `from t402 import PaymentMiddleware
from t402.schemes import exact

middleware = PaymentMiddleware({
    "GET /api/data": {
        "price": "$0.01",
        "network": "base",
        "accepts": [
            exact.evm(
                address="0x...",
                network="base",
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
    language: "Go 1.21+",
    description:
      "High-performance Go SDK for building payment-enabled APIs and services. Ideal for microservices and high-throughput applications.",
    icon: "go",
    installCommand: "go get github.com/t402-io/t402/go",
    packageManager: "go",
    version: "2.0.0",
    docsUrl: "https://docs.t402.io/sdks/go",
    githubUrl: "https://github.com/t402-io/t402/tree/main/go",
    features: [
      "net/http compatible",
      "Gin, Echo, Fiber middleware",
      "Zero allocation design",
      "Context-based API",
      "EVM & Solana support",
      "Facilitator client",
    ],
    codeExample: `import (
    "github.com/t402-io/t402/go"
    "github.com/t402-io/t402/go/schemes/exact"
)

middleware := t402.NewMiddleware(t402.Config{
    Routes: map[string]t402.Route{
        "GET /api/data": {
            Price:   "$0.01",
            Network: "base",
            Accepts: []t402.Scheme{
                exact.EVM("0x...", "base"),
            },
        },
    },
})

http.Handle("/", middleware(handler))`,
    color: "#00ADD8",
  },
];

export const typescriptPackages: Package[] = [
  {
    name: "@t402/core",
    npmPackage: "@t402/core",
    description: "Core protocol types, utilities, and base functionality",
    features: ["Protocol types", "Payment verification", "Signature handling", "Utility functions"],
  },
  {
    name: "@t402/evm",
    npmPackage: "@t402/evm",
    description: "EVM chain support (Ethereum, Base, Arbitrum, Optimism, etc.)",
    features: ["Multi-chain support", "ERC-4337 gasless", "USDT/USDC payments", "Viem integration"],
  },
  {
    name: "@t402/svm",
    npmPackage: "@t402/svm",
    description: "Solana Virtual Machine support",
    features: ["SPL token payments", "Transaction building", "Wallet adapters", "Jupiter integration"],
  },
  {
    name: "@t402/next",
    npmPackage: "@t402/next",
    description: "Next.js integration with App Router support",
    features: ["Server actions", "API routes", "Middleware", "React components"],
  },
  {
    name: "@t402/paywall",
    npmPackage: "@t402/paywall",
    description: "Drop-in payment UI components",
    features: ["React components", "Wallet connection", "Payment flow", "Customizable themes"],
  },
  {
    name: "@t402/mcp",
    npmPackage: "@t402/mcp",
    description: "Model Context Protocol for AI agent payments",
    features: ["AI agent support", "Tool definitions", "Autonomous payments", "Claude integration"],
  },
];

export const supportedChains = [
  { name: "Ethereum", id: "ethereum", color: "#627EEA" },
  { name: "Base", id: "base", color: "#0052FF" },
  { name: "Arbitrum", id: "arbitrum", color: "#28A0F0" },
  { name: "Optimism", id: "optimism", color: "#FF0420" },
  { name: "Polygon", id: "polygon", color: "#8247E5" },
  { name: "Solana", id: "solana", color: "#9945FF" },
  { name: "TON", id: "ton", color: "#0098EA" },
  { name: "TRON", id: "tron", color: "#FF0000" },
];
