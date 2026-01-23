/**
 * Feature Data for t402
 */

export interface Feature {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  benefits: {
    title: string;
    description: string;
  }[];
  technicalDetails: {
    title: string;
    content: string;
  }[];
  supportedChains: string[];
  codeExample?: {
    title: string;
    language: string;
    code: string;
  };
  useCases: string[];
  docsUrl: string;
  badge?: "new" | "beta" | "coming-soon";
}

export const features: Feature[] = [
  {
    id: "gasless",
    slug: "gasless",
    name: "Gasless Transactions",
    tagline: "Zero gas fees for your users",
    description:
      "Enable USDT and USDC payments without requiring users to hold native tokens for gas. EIP-3009 and ERC-4337 account abstraction make it possible across 19+ EVM chains.",
    icon: "gasless",
    color: "#10B981",
    benefits: [
      {
        title: "Better User Experience",
        description:
          "Users don't need ETH, MATIC, or other native tokens. They pay only in stablecoins.",
      },
      {
        title: "Higher Conversion Rates",
        description:
          "Remove the friction of acquiring gas tokens. Users can pay immediately with what they have.",
      },
      {
        title: "Simplified Onboarding",
        description:
          "New users can start transacting without understanding gas or bridging tokens.",
      },
      {
        title: "Predictable Costs",
        description:
          "Transaction fees are paid in stablecoins, making costs predictable regardless of network congestion.",
      },
    ],
    technicalDetails: [
      {
        title: "EIP-3009: Transfer With Authorization",
        content:
          "Allows token transfers via signed messages. The user signs a permit, and a relayer submits the transaction, paying the gas on behalf of the user.",
      },
      {
        title: "ERC-4337: Account Abstraction",
        content:
          "Smart contract wallets that can pay gas in any token. Bundlers aggregate user operations and submit them to the network.",
      },
      {
        title: "Paymaster Contracts",
        content:
          "Sponsor gas fees for specific operations. The paymaster validates and pays for user operations that meet certain criteria.",
      },
      {
        title: "Relayer Network",
        content:
          "Decentralized relayers compete to submit transactions, ensuring reliability and competitive pricing.",
      },
    ],
    supportedChains: [
      "Ethereum", "Arbitrum", "Optimism", "Polygon", "Ink", "Berachain", "Unichain",
      "Mantle", "Sei", "Conflux eSpace", "Monad", "Flare", "Rootstock", "XLayer",
      "Stable", "HyperEVM", "MegaETH", "Corn", "Plasma",
    ],
    codeExample: {
      title: "Gasless USDT0 Transfer",
      language: "typescript",
      code: `import { createGaslessTransfer } from "@t402/wdk-gasless";

// User signs an EIP-3009 authorization (no gas needed)
const authorization = await createGaslessTransfer({
  token: "USDT0",
  from: userAddress,
  to: merchantAddress,
  amount: "10.00",
  network: "eip155:8453", // Base
  deadline: Math.floor(Date.now() / 1000) + 3600,
});

// Facilitator submits the transaction on-chain
const result = await facilitator.settle(authorization);
console.log("Transfer complete:", result.txHash);`,
    },
    useCases: [
      "E-commerce checkout without gas requirements",
      "Subscription payments in stablecoins",
      "Micropayments for content access",
      "Cross-border payments for users new to crypto",
    ],
    docsUrl: "https://docs.t402.io/advanced/gasless",
  },
  {
    id: "bridge",
    slug: "bridge",
    name: "Cross-Chain Bridge",
    tagline: "USDT0 across all chains via LayerZero",
    description:
      "Bridge USDT seamlessly between 19+ supported chains using LayerZero's OFT (Omnichain Fungible Token) standard. Same token, any chain, instant liquidity.",
    icon: "bridge",
    color: "#8B5CF6",
    benefits: [
      {
        title: "Unified Liquidity",
        description:
          "USDT0 maintains the same value and properties across all chains. No wrapped tokens or liquidity fragmentation.",
      },
      {
        title: "Fast Finality",
        description:
          "LayerZero provides secure cross-chain messaging with configurable security parameters.",
      },
      {
        title: "Lower Fees",
        description:
          "Direct chain-to-chain transfers without intermediate tokens or multiple swaps.",
      },
      {
        title: "Native Integration",
        description:
          "Built into the t402 protocol. Accept payments on any chain, settle on your preferred chain.",
      },
    ],
    technicalDetails: [
      {
        title: "LayerZero OFT Standard",
        content:
          "Omnichain Fungible Tokens enable native cross-chain transfers. The token is burned on the source chain and minted on the destination.",
      },
      {
        title: "Security Model",
        content:
          "LayerZero uses decentralized verifier networks (DVNs) to validate cross-chain messages. Configurable security for different risk tolerances.",
      },
      {
        title: "19+ Supported Routes",
        content:
          "USDT0 can be bridged between Ethereum, Arbitrum, Base, Optimism, Berachain, Unichain, Ink, Avalanche, BNB Chain, zkSync, Scroll, Linea, and more.",
      },
      {
        title: "Gas Optimization",
        content:
          "Batched bridge operations reduce per-transfer costs. Automatic route optimization for best prices.",
      },
    ],
    supportedChains: [
      "Ethereum", "Arbitrum", "Optimism", "Polygon", "Ink", "Berachain", "Unichain",
      "Mantle", "Sei", "Conflux eSpace", "Monad", "Flare", "Rootstock", "XLayer",
      "Stable", "HyperEVM", "MegaETH", "Corn", "Plasma",
    ],
    codeExample: {
      title: "Bridge USDT0 from Arbitrum to Base",
      language: "typescript",
      code: `import { bridge } from "@t402/wdk-bridge";

const result = await bridge({
  token: "USDT0",
  from: {
    network: "eip155:42161", // Arbitrum
    address: userAddress,
  },
  to: {
    network: "eip155:8453", // Base
    address: userAddress,
  },
  amount: "100.00",
});

console.log("Bridge initiated:", result.srcTxHash);
console.log("Destination:", result.dstTxHash);`,
    },
    useCases: [
      "Accept payments on cheap L2s, settle on mainnet",
      "Consolidate treasury across multiple chains",
      "Enable users to pay from any supported chain",
      "Cross-chain payment routing optimization",
    ],
    docsUrl: "https://docs.t402.io/advanced/bridge",
  },
  {
    id: "mcp",
    slug: "mcp",
    name: "AI Agent Payments (MCP)",
    tagline: "Model Context Protocol for autonomous payments",
    description:
      "Enable AI agents to make and receive payments autonomously using the Model Context Protocol (MCP). Built for the agentic economy with budget controls and audit trails.",
    icon: "mcp",
    color: "#F59E0B",
    benefits: [
      {
        title: "Autonomous Transactions",
        description:
          "AI agents can pay for resources, APIs, and services without human intervention.",
      },
      {
        title: "Budget Controls",
        description:
          "Set spending limits, approved merchants, and transaction rules for your agents.",
      },
      {
        title: "Audit Trail",
        description:
          "Every agent transaction is logged with context about why the payment was made.",
      },
      {
        title: "Multi-Agent Support",
        description:
          "Manage payments across fleets of agents with hierarchical permissions.",
      },
    ],
    technicalDetails: [
      {
        title: "MCP Integration",
        content:
          "The @t402/mcp package provides MCP tools for payment operations. Agents can check balances, make payments, and verify transactions.",
      },
      {
        title: "Tool Definitions",
        content:
          "Standard MCP tools: t402_pay, t402_balance, t402_verify, t402_history. Compatible with Claude, GPT, and other MCP-enabled models.",
      },
      {
        title: "Spending Policies",
        content:
          "Define rules in JSON: max per-transaction, daily limits, approved recipients, required confirmations for large amounts.",
      },
      {
        title: "Wallet Abstraction",
        content:
          "Agents operate with derived keys or smart contract wallets. Parent accounts maintain ultimate control.",
      },
    ],
    supportedChains: [
      "Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "Avalanche",
      "BNB Chain", "zkSync Era", "Linea", "Scroll", "Ink", "Berachain",
      "Unichain", "Mantle", "Sei", "Corn", "Conflux eSpace",
      "Solana", "TON", "TRON", "NEAR", "Aptos", "Tezos", "Polkadot", "Stacks",
    ],
    codeExample: {
      title: "MCP Server with Payment Tools",
      language: "typescript",
      code: `import { createMCPServer } from "@t402/mcp";

const server = createMCPServer({
  wallet: agentWallet,
  policies: {
    maxPerTransaction: "10.00",
    dailyLimit: "100.00",
    approvedRecipients: ["0x...", "0x..."],
  },
  networks: ["eip155:8453", "eip155:42161"],
});

// Agent can now use t402_pay tool
// Claude: "Pay $5 USDT0 to the API provider"
// → t402_pay({ to: "0x...", amount: "5.00", network: "eip155:8453" })`,
    },
    useCases: [
      "AI agents paying for API access",
      "Automated content purchasing",
      "Agent-to-agent service payments",
      "Research agents buying data access",
    ],
    docsUrl: "https://docs.t402.io/advanced/mcp",
  },
  {
    id: "multisig",
    slug: "multisig",
    name: "Multi-Signature Support",
    tagline: "Enterprise-grade security with Safe",
    description:
      "Accept payments to multi-signature wallets using Safe (formerly Gnosis Safe). Perfect for teams, DAOs, and enterprises requiring multiple approvals.",
    icon: "multisig",
    color: "#EC4899",
    benefits: [
      {
        title: "Shared Custody",
        description:
          "Require multiple signers for transactions. No single point of failure or compromise.",
      },
      {
        title: "Flexible Policies",
        description:
          "Configure M-of-N signing requirements. 2-of-3, 3-of-5, or any combination you need.",
      },
      {
        title: "Role-Based Access",
        description:
          "Different team members can have different permissions. Spending limits per signer.",
      },
      {
        title: "Audit Compliance",
        description:
          "Full transaction history with signer attribution. Export for accounting and compliance.",
      },
    ],
    technicalDetails: [
      {
        title: "Safe Protocol",
        content:
          "Integration with Safe{Core} protocol. Create and manage Safes programmatically through the t402 SDK.",
      },
      {
        title: "Transaction Queue",
        content:
          "Pending transactions visible to all signers. Push notifications for signature requests.",
      },
      {
        title: "Module Support",
        content:
          "Compatible with Safe modules for allowances, recurring payments, and spending limits.",
      },
      {
        title: "Recovery Options",
        content:
          "Social recovery and guardian systems for account recovery without compromising security.",
      },
    ],
    supportedChains: ["Ethereum", "Arbitrum", "Optimism", "Polygon", "Berachain", "Unichain", "Mantle"],
    codeExample: {
      title: "Configure Multi-sig Receiving",
      language: "typescript",
      code: `import { ExactEvmServer } from "@t402/evm/exact/server";

app.use(paymentMiddleware({
  "GET /api/premium": {
    price: "$100.00",
    network: "eip155:8453",
    schemes: [
      new ExactEvmServer({
        // Safe multisig address
        payTo: "0xSafeAddress...",
      }),
    ],
  },
}));`,
    },
    useCases: [
      "DAO treasury management",
      "Team revenue collection",
      "Enterprise payment receiving",
      "Escrow and milestone payments",
    ],
    docsUrl: "https://docs.t402.io/advanced/multisig",
  },
  // New features
  {
    id: "agent-policy",
    slug: "agent-policy",
    name: "Agent Policy Engine",
    tagline: "Declarative spending rules for AI wallets",
    description:
      "Define fine-grained spending policies for autonomous AI agents. Control budgets, recipients, time windows, and approval thresholds with a declarative JSON policy language.",
    icon: "policy",
    color: "#6366F1",
    badge: "beta",
    benefits: [
      {
        title: "Granular Control",
        description:
          "Set per-transaction limits, daily budgets, and cumulative spending caps for each agent.",
      },
      {
        title: "Recipient Allowlists",
        description:
          "Restrict which addresses an agent can pay. Prevent unauthorized fund transfers.",
      },
      {
        title: "Time-Based Rules",
        description:
          "Enforce business hours, rate limiting, and cooling periods between transactions.",
      },
      {
        title: "Hierarchical Permissions",
        description:
          "Parent agents can delegate budgets to child agents with inherited policy constraints.",
      },
    ],
    technicalDetails: [
      {
        title: "Policy Language",
        content:
          "JSON-based declarative policies with conditions, actions, and effects. Supports AND/OR logic for complex rules.",
      },
      {
        title: "Real-Time Enforcement",
        content:
          "Policies are evaluated at transaction time. No on-chain governance delays for spending decisions.",
      },
      {
        title: "Audit Logging",
        content:
          "Every policy evaluation is logged with the decision, matched rules, and context for compliance.",
      },
      {
        title: "Policy Inheritance",
        content:
          "Child agents inherit parent policies. More restrictive child policies can further limit spending.",
      },
    ],
    supportedChains: [
      "Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "Avalanche",
      "BNB Chain", "zkSync Era", "Linea", "Scroll", "Ink", "Berachain",
      "Unichain", "Mantle", "Sei", "Corn", "Conflux eSpace",
      "Solana", "TON", "TRON", "NEAR", "Aptos", "Tezos", "Polkadot", "Stacks",
    ],
    codeExample: {
      title: "Define Agent Spending Policy",
      language: "typescript",
      code: `import { definePolicy } from "@t402/agent-policy";

const policy = definePolicy({
  name: "research-agent",
  rules: [
    {
      effect: "allow",
      maxAmount: "5.00",
      recipients: ["0xAPIProvider...", "0xDataVendor..."],
      rateLimit: { max: 10, window: "1h" },
    },
    {
      effect: "require-approval",
      condition: { amountGte: "50.00" },
      approvers: ["admin@team.com"],
    },
    { effect: "deny", condition: { always: true } },
  ],
});`,
    },
    useCases: [
      "Research agents with budget constraints",
      "Fleet management for agent swarms",
      "Compliance-friendly autonomous spending",
      "Delegated treasury management",
    ],
    docsUrl: "https://docs.t402.io/advanced/agent-policy",
  },
  {
    id: "a2a",
    slug: "a2a",
    name: "Agent-to-Agent (A2A)",
    tagline: "Google A2A protocol for inter-agent commerce",
    description:
      "Enable autonomous agent-to-agent commerce using Google's A2A (Agent-to-Agent) protocol. Agents can discover services, negotiate prices, and settle payments without human intervention.",
    icon: "a2a",
    color: "#14B8A6",
    badge: "beta",
    benefits: [
      {
        title: "Service Discovery",
        description:
          "Agents advertise capabilities and pricing. Other agents discover and consume services on demand.",
      },
      {
        title: "Price Negotiation",
        description:
          "Built-in negotiation protocol allows agents to agree on terms before committing to payments.",
      },
      {
        title: "Multi-Step Workflows",
        description:
          "Chain multiple agent services together. Pay-per-step with rollback on failure.",
      },
      {
        title: "Protocol Interop",
        description:
          "Works alongside MCP. Use MCP for tool access and A2A for inter-agent commerce.",
      },
    ],
    technicalDetails: [
      {
        title: "A2A Transport",
        content:
          "Built on Google's A2A protocol specification. Agents communicate via structured messages with payment negotiation extensions.",
      },
      {
        title: "Agent Cards",
        content:
          "Each agent publishes an Agent Card describing capabilities, pricing, and accepted payment methods via t402.",
      },
      {
        title: "Task-Based Payments",
        content:
          "Payments are tied to task completion. Escrow and milestone patterns ensure fair exchange.",
      },
      {
        title: "Discovery Protocol",
        content:
          "Agents register with discovery services. Type-safe service matching for finding compatible agents.",
      },
    ],
    supportedChains: [
      "Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "Avalanche",
      "BNB Chain", "zkSync Era", "Linea", "Scroll", "Ink", "Berachain",
      "Unichain", "Mantle", "Sei", "Corn", "Conflux eSpace",
      "Solana", "TON", "TRON", "NEAR", "Aptos", "Tezos", "Polkadot", "Stacks",
    ],
    codeExample: {
      title: "A2A Agent with Payment Capability",
      language: "typescript",
      code: `import { createA2AAgent } from "@t402/a2a-negotiation";

const agent = createA2AAgent({
  name: "data-analysis-agent",
  capabilities: ["csv-analysis", "chart-generation"],
  pricing: {
    "csv-analysis": { price: "$0.05", network: "eip155:8453" },
    "chart-generation": { price: "$0.10", network: "eip155:8453" },
  },
  wallet: agentWallet,
});

// Other agents can discover and pay for services
// Agent B: "Analyze this CSV file"
// → Negotiation → Payment → Task execution → Result`,
    },
    useCases: [
      "Multi-agent data processing pipelines",
      "Autonomous service marketplaces",
      "Agent-powered API aggregation",
      "Decentralized compute markets",
    ],
    docsUrl: "https://docs.t402.io/advanced/a2a",
  },
  {
    id: "streaming",
    slug: "streaming",
    name: "Streaming Payments",
    tagline: "Pay-per-second for continuous access",
    description:
      "Enable continuous payment streams for ongoing resource access. Charge per-second, per-request, or per-byte with automatic top-up and usage metering.",
    icon: "streaming",
    color: "#06B6D4",
    badge: "beta",
    benefits: [
      {
        title: "Granular Billing",
        description:
          "Charge exactly for what's consumed. No overpaying for unused time or resources.",
      },
      {
        title: "Real-Time Metering",
        description:
          "Track usage in real-time with automatic billing at configurable intervals.",
      },
      {
        title: "Auto-Topup",
        description:
          "Streams automatically refill from user balance. No interruptions in service.",
      },
      {
        title: "Instant Settlement",
        description:
          "Providers can withdraw earned funds instantly without waiting for stream completion.",
      },
    ],
    technicalDetails: [
      {
        title: "Stream Protocol",
        content:
          "Extension to the t402 payment protocol. Streams are opened with an initial deposit and flow at a configurable rate.",
      },
      {
        title: "Usage Metering",
        content:
          "Built-in metering for time, requests, bytes, and custom units. Meter readings trigger payment claims.",
      },
      {
        title: "Deposit & Withdraw",
        content:
          "Users deposit to open a stream. Providers claim earned amounts. Remaining balance is refundable.",
      },
      {
        title: "Rate Adjustment",
        content:
          "Streams can adjust rates dynamically based on usage patterns or tier upgrades.",
      },
    ],
    supportedChains: [
      "Ethereum", "Base", "Arbitrum", "Optimism", "Solana",
    ],
    codeExample: {
      title: "Open a Payment Stream",
      language: "typescript",
      code: `import { createStream } from "@t402/streaming-payments";

const stream = await createStream({
  recipient: "0xAPIProvider...",
  network: "eip155:8453",
  rate: {
    amount: "0.001",  // $0.001 per second
    interval: "second",
  },
  deposit: "10.00",  // Initial deposit
  autoTopup: true,
});

// Access resource while stream is active
const data = await fetch(apiUrl, {
  headers: { "X-T402-Stream": stream.id },
});

// Close stream when done
await stream.close(); // Refunds unused deposit`,
    },
    useCases: [
      "AI model inference billing",
      "Video/audio streaming access",
      "Real-time data feed subscriptions",
      "Compute resource metering",
    ],
    docsUrl: "https://docs.t402.io/advanced/streaming",
  },
  {
    id: "zk-payments",
    slug: "zk-payments",
    name: "Zero-Knowledge Payments",
    tagline: "Privacy-preserving transactions with ZK proofs",
    description:
      "Make payments with zero-knowledge proofs to hide transaction amounts while proving payment validity. Selective disclosure enables compliance-friendly privacy.",
    icon: "zk",
    color: "#A855F7",
    badge: "coming-soon",
    benefits: [
      {
        title: "Amount Privacy",
        description:
          "Transaction amounts are hidden from observers. Only sender and receiver know the value.",
      },
      {
        title: "Selective Disclosure",
        description:
          "Prove payment properties (e.g., amount > $X) without revealing the exact amount.",
      },
      {
        title: "Compliance Ready",
        description:
          "Generate audit proofs for regulators without exposing all transaction details.",
      },
      {
        title: "On-Chain Verification",
        description:
          "ZK proofs are verified on-chain. No trusted third party needed for privacy.",
      },
    ],
    technicalDetails: [
      {
        title: "ZK Circuit",
        content:
          "Custom circuits for payment verification. Proves: sender has sufficient balance, amount matches commitment, recipient is valid.",
      },
      {
        title: "Commitment Scheme",
        content:
          "Pedersen commitments hide amounts while allowing range proofs and sum verification.",
      },
      {
        title: "Proof Generation",
        content:
          "Client-side proof generation using Groth16. Sub-second proving time on modern hardware.",
      },
      {
        title: "Verifier Contract",
        content:
          "On-chain verifier validates proofs. Gas cost comparable to standard ERC-20 transfer.",
      },
    ],
    supportedChains: [
      "Ethereum", "Arbitrum", "Optimism", "Polygon", "Ink",
    ],
    useCases: [
      "Private B2B transactions",
      "Salary payments with amount privacy",
      "Competitive bid submissions",
      "Medical payment confidentiality",
    ],
    docsUrl: "https://docs.t402.io/advanced/zk-payments",
  },
  {
    id: "smart-router",
    slug: "smart-router",
    name: "Smart Payment Router",
    tagline: "Optimal path finding across chains and tokens",
    description:
      "Automatically find the cheapest and fastest payment path across all supported chains. Smart routing considers gas costs, bridge fees, slippage, and settlement time.",
    icon: "router",
    color: "#F97316",
    badge: "beta",
    benefits: [
      {
        title: "Best-Price Execution",
        description:
          "Finds the lowest-cost path considering gas, bridge fees, and token availability.",
      },
      {
        title: "Multi-Hop Routing",
        description:
          "Automatically routes through intermediate chains when direct paths are expensive.",
      },
      {
        title: "Fallback Chains",
        description:
          "If primary chain is congested or unavailable, automatically falls back to alternatives.",
      },
      {
        title: "Fee Transparency",
        description:
          "Shows total cost breakdown before execution. No hidden fees or unexpected slippage.",
      },
    ],
    technicalDetails: [
      {
        title: "Route Discovery",
        content:
          "Graph-based pathfinding across all supported chains. Considers bridge availability, gas prices, and token liquidity.",
      },
      {
        title: "Cost Estimation",
        content:
          "Real-time gas price feeds and bridge fee APIs. Accurate cost estimates before execution.",
      },
      {
        title: "Execution Engine",
        content:
          "Atomic multi-step execution with rollback on failure. Ensures funds are never stuck in transit.",
      },
      {
        title: "Route Caching",
        content:
          "Popular routes are cached with TTL. Fast responses for common payment patterns.",
      },
    ],
    supportedChains: [
      "Ethereum", "Arbitrum", "Optimism", "Polygon", "Ink", "Berachain", "Unichain",
      "Mantle", "Sei", "Solana", "TON", "TRON",
    ],
    codeExample: {
      title: "Auto-Route Payment Across Chains",
      language: "typescript",
      code: `import { routePayment } from "@t402/smart-router";

const route = await routePayment({
  from: {
    address: userAddress,
    balances: await getBalances(userAddress),
  },
  to: {
    address: merchantAddress,
    network: "eip155:8453", // Merchant wants Base
  },
  amount: "50.00",
  preferences: {
    optimize: "cost", // or "speed"
    maxHops: 2,
  },
});

console.log("Route:", route.path);      // ["eip155:42161", "eip155:8453"]
console.log("Total cost:", route.fees); // "$0.12"
await route.execute();`,
    },
    useCases: [
      "Cross-chain payment optimization",
      "Multi-wallet balance aggregation",
      "Merchant payment flexibility",
      "Automatic chain selection for lowest fees",
    ],
    docsUrl: "https://docs.t402.io/advanced/smart-router",
  },
  {
    id: "intent-payments",
    slug: "intent-payments",
    name: "Intent-Based Payments",
    tagline: "Express what you want, let solvers find the best path",
    description:
      "Express payment intents and let a network of solvers compete to fulfill them optimally. MEV-protected, cross-chain, and gas-optimized execution.",
    icon: "intent",
    color: "#EC4899",
    badge: "coming-soon",
    benefits: [
      {
        title: "Optimal Execution",
        description:
          "Solvers compete to find the best execution path. Users get better prices than manual routing.",
      },
      {
        title: "MEV Protection",
        description:
          "Intent-based execution prevents front-running and sandwich attacks on your payments.",
      },
      {
        title: "Cross-Chain Native",
        description:
          "Express intents across any chain. Solvers handle bridging and routing complexity.",
      },
      {
        title: "Gasless for Users",
        description:
          "Solvers pay gas and recover costs from the payment amount. Users sign intents off-chain.",
      },
    ],
    technicalDetails: [
      {
        title: "Intent Expression",
        content:
          "Typed intent objects describe desired outcome: 'send $X of USDT to address Y on chain Z, from any of my balances.'",
      },
      {
        title: "Solver Network",
        content:
          "Decentralized solvers stake collateral and compete to fill intents. Slashing for failed fills.",
      },
      {
        title: "Auction Mechanism",
        content:
          "Dutch auction for solver selection. Price decreases over time until a solver fills the intent.",
      },
      {
        title: "Settlement",
        content:
          "On-chain settlement contracts verify solver execution matches intent parameters.",
      },
    ],
    supportedChains: [
      "Ethereum", "Base", "Arbitrum", "Optimism", "Polygon",
    ],
    useCases: [
      "Complex cross-chain payments",
      "MEV-protected large transfers",
      "Multi-source balance spending",
      "Deadline-based payment scheduling",
    ],
    docsUrl: "https://docs.t402.io/advanced/intents",
  },
];

export function getFeatureBySlug(slug: string): Feature | undefined {
  return features.find((f) => f.slug === slug);
}

export function getAllFeatureSlugs(): string[] {
  return features.map((f) => f.slug);
}

export function getActiveFeatures(): Feature[] {
  return features.filter((f) => f.badge !== "coming-soon");
}

export function getBetaFeatures(): Feature[] {
  return features.filter((f) => f.badge === "beta");
}
