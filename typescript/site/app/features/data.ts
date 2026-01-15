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
}

export const features: Feature[] = [
  {
    id: "gasless",
    slug: "gasless",
    name: "Gasless Transactions",
    tagline: "Zero gas fees for your users",
    description:
      "Enable USDT and USDC payments without requiring users to hold native tokens for gas. EIP-3009 and ERC-4337 account abstraction make it possible.",
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
    supportedChains: ["Ethereum", "Base", "Arbitrum", "Polygon", "Berachain", "Unichain", "Ink"],
    codeExample: {
      title: "Gasless USDC Transfer",
      language: "typescript",
      code: `import { createGaslessTransfer } from "@t402/evm";

// User signs a permit (no gas needed)
const permit = await createGaslessTransfer({
  token: "USDC",
  from: userAddress,
  to: merchantAddress,
  amount: "10.00",
  deadline: Math.floor(Date.now() / 1000) + 3600,
});

// Relayer submits the transaction
const tx = await relayer.submitPermit(permit);
console.log("Transfer complete:", tx.hash);`,
    },
    useCases: [
      "E-commerce checkout without gas requirements",
      "Subscription payments in stablecoins",
      "Micropayments for content access",
      "Cross-border payments for users new to crypto",
    ],
    docsUrl: "https://docs.t402.io/features/gasless",
  },
  {
    id: "bridge",
    slug: "bridge",
    name: "Cross-Chain Bridge",
    tagline: "USDT0 across all chains via LayerZero",
    description:
      "Bridge USDT seamlessly between supported chains using LayerZero's OFT (Omnichain Fungible Token) standard. Same token, any chain.",
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
        title: "Supported Routes",
        content:
          "USDT0 can be bridged between Ethereum, Arbitrum, Berachain, Unichain, and Ink. More chains coming soon.",
      },
      {
        title: "Gas Optimization",
        content:
          "Batched bridge operations reduce per-transfer costs. Automatic route optimization for best prices.",
      },
    ],
    supportedChains: ["Ethereum", "Arbitrum", "Berachain", "Unichain", "Ink"],
    codeExample: {
      title: "Bridge USDT0 from Arbitrum to Base",
      language: "typescript",
      code: `import { bridge } from "@t402/evm";

const result = await bridge({
  token: "USDT0",
  from: {
    chain: "arbitrum",
    address: userAddress,
  },
  to: {
    chain: "ethereum",
    address: userAddress,
  },
  amount: "100.00",
});

console.log("Bridge initiated:", result.srcTxHash);
console.log("Estimated arrival:", result.estimatedTime);`,
    },
    useCases: [
      "Accept payments on cheap L2s, settle on mainnet",
      "Consolidate treasury across multiple chains",
      "Enable users to pay from any supported chain",
      "Arbitrage opportunities across chain prices",
    ],
    docsUrl: "https://docs.t402.io/features/bridge",
  },
  {
    id: "mcp",
    slug: "mcp",
    name: "AI Agent Payments",
    tagline: "Model Context Protocol for autonomous payments",
    description:
      "Enable AI agents to make and receive payments autonomously using the Model Context Protocol (MCP). Built for the agentic economy.",
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
    supportedChains: ["Base", "Ethereum", "Arbitrum", "Polygon", "Solana"],
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
});

// Agent can now use t402_pay tool
// Claude: "Pay $5 USDC to the API provider"
// → t402_pay({ to: "0x...", amount: "5.00", token: "USDC" })`,
    },
    useCases: [
      "AI agents paying for API access",
      "Automated content purchasing",
      "Agent-to-agent service payments",
      "Research agents buying data access",
    ],
    docsUrl: "https://docs.t402.io/features/mcp",
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
    supportedChains: ["Ethereum", "Base", "Arbitrum", "Polygon", "Optimism"],
    codeExample: {
      title: "Configure Multi-sig Receiving",
      language: "typescript",
      code: `import { evm } from "@t402/evm";

// Accept payments to a Safe multisig
app.use(paymentMiddleware({
  "GET /api/premium": {
    price: "$100.00",
    network: "base",
    accepts: [
      evm({
        // Safe multisig address
        address: "0xSafeAddress...",
        network: "base",
        // Payments go directly to the Safe
        type: "safe",
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
    docsUrl: "https://docs.t402.io/features/multisig",
  },
];

export function getFeatureBySlug(slug: string): Feature | undefined {
  return features.find((f) => f.slug === slug);
}

export function getAllFeatureSlugs(): string[] {
  return features.map((f) => f.slug);
}
