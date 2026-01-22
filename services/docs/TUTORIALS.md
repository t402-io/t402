# t402 Tutorials

Step-by-step guides for common t402 integration patterns.

## Table of Contents

1. [Building a Paid API Endpoint](#building-a-paid-api-endpoint)
2. [Integrating with React/Next.js](#integrating-with-reactnextjs)
3. [Using Gasless Payments](#using-gasless-payments)
4. [Cross-Chain Bridging](#cross-chain-bridging)
5. [AI Agent Payments with MCP](#ai-agent-payments-with-mcp)

---

## Building a Paid API Endpoint

This tutorial shows how to monetize your API with t402 payments.

### Prerequisites

- Node.js 18+
- An EVM wallet address to receive payments
- Basic Express.js knowledge

### Step 1: Set Up the Project

```bash
mkdir my-paid-api
cd my-paid-api
pnpm init
pnpm add express @t402/core @t402/express @t402/evm
pnpm add -D typescript @types/express ts-node
```

### Step 2: Create the Server

```typescript
// src/server.ts
import express from "express";
import { paymentMiddleware } from "@t402/express";
import { createFacilitatorClient } from "@t402/core";

const app = express();

// Initialize facilitator client
const facilitator = createFacilitatorClient({
  url: "https://facilitator.t402.io",
});

// Define pricing for each endpoint
const paymentConfig = {
  // Free tier
  "GET /api/status": null, // No payment required

  // Basic tier - $0.001 per request
  "GET /api/data": {
    accepts: [
      { scheme: "exact", network: "eip155:8453", price: "$0.001", payTo: process.env.WALLET! },
    ],
    description: "Basic data endpoint",
  },

  // Premium tier - $0.01 per request
  "GET /api/premium": {
    accepts: [
      { scheme: "exact", network: "eip155:8453", price: "$0.01", payTo: process.env.WALLET! },
      { scheme: "exact", network: "eip155:42161", price: "$0.01", payTo: process.env.WALLET! },
    ],
    description: "Premium data with multiple network options",
  },
};

// Apply payment middleware
app.use(paymentMiddleware(paymentConfig, facilitator));

// Endpoints
app.get("/api/status", (req, res) => {
  res.json({ status: "healthy", timestamp: Date.now() });
});

app.get("/api/data", (req, res) => {
  res.json({ data: "Basic data response", tier: "basic" });
});

app.get("/api/premium", (req, res) => {
  res.json({ data: "Premium data response", tier: "premium", extra: { ... } });
});

app.listen(3000, () => console.log("Server running on :3000"));
```

### Step 3: Test with cURL

```bash
# Free endpoint
curl http://localhost:3000/api/status

# Paid endpoint (returns 402 Payment Required)
curl -i http://localhost:3000/api/data
```

### Step 4: Handle Payments in Client

See [Client Integration](#building-a-paid-api-endpoint) for client setup.

---

## Integrating with React/Next.js

Build a frontend that handles t402 payments seamlessly.

### Prerequisites

- Next.js 14+ project
- React 18+
- A configured wallet (viem)

### Step 1: Install Dependencies

```bash
pnpm add @t402/react @t402/core @t402/fetch @t402/evm
```

### Step 2: Create Payment Provider

```tsx
// app/providers.tsx
"use client";

import { T402Provider, createT402Client } from "@t402/react";
import { registerExactEvmScheme } from "@t402/evm/exact/client";
import { useAccount } from "wagmi";
import { useMemo } from "react";

export function T402ProviderWrapper({ children }: { children: React.ReactNode }) {
  const { address, connector } = useAccount();

  const client = useMemo(() => {
    if (!connector) return null;

    const c = createT402Client();

    // Register EVM signer when wallet is connected
    registerExactEvmScheme(c, {
      getSigner: async () => {
        const walletClient = await connector.getWalletClient();
        return walletClient;
      },
    });

    return c;
  }, [connector]);

  return (
    <T402Provider client={client}>
      {children}
    </T402Provider>
  );
}
```

### Step 3: Use Payment Hook

```tsx
// app/components/PaidContent.tsx
"use client";

import { useT402Fetch, useT402PaymentStatus } from "@t402/react";
import { useState } from "react";

export function PaidContent() {
  const fetchWithPayment = useT402Fetch();
  const { isPaying, lastPayment } = useT402PaymentStatus();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadPremiumData = async () => {
    setLoading(true);
    try {
      const response = await fetchWithPayment("/api/premium");
      const json = await response.json();
      setData(json);
    } catch (error) {
      console.error("Failed to load:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={loadPremiumData} disabled={loading || isPaying}>
        {isPaying ? "Processing Payment..." : "Load Premium Data ($0.01)"}
      </button>

      {lastPayment && (
        <p>Last payment: {lastPayment.amount} on {lastPayment.network}</p>
      )}

      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

### Step 4: Server API Route (Next.js)

```typescript
// app/api/premium/route.ts
import { withT402 } from "@t402/next";

export const GET = withT402(
  async (request) => {
    return Response.json({
      data: "Premium content",
      timestamp: Date.now(),
    });
  },
  {
    price: "$0.01",
    network: "eip155:8453",
    payTo: process.env.WALLET_ADDRESS!,
    description: "Premium API endpoint",
  }
);
```

---

## Using Gasless Payments

Enable users to make payments without needing ETH for gas.

### Prerequisites

- Pimlico, Alchemy, or other bundler API key
- Understanding of ERC-4337

### Step 1: Install Dependencies

```bash
pnpm add @t402/wdk-gasless @t402/evm viem
```

### Step 2: Create Gasless Client

```typescript
import { createWdkGaslessClient } from "@t402/wdk-gasless";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

// Create public client for the chain
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

// Create gasless payment client
const gaslessClient = await createWdkGaslessClient({
  // Your WDK account (from @tetherto/wdk)
  wdkAccount: myWdkAccount,

  // Viem public client
  publicClient,

  // Chain configuration
  chainId: 8453, // Base

  // Bundler configuration (Pimlico example)
  bundler: {
    bundlerUrl: `https://api.pimlico.io/v2/base/rpc?apikey=${PIMLICO_KEY}`,
    chainId: 8453,
  },

  // Paymaster configuration (for gas sponsorship)
  paymaster: {
    address: "0x...", // Paymaster contract address
    url: `https://api.pimlico.io/v2/base/rpc?apikey=${PIMLICO_KEY}`,
    type: "sponsoring", // or "verifying", "token"
  },
});
```

### Step 3: Check Balance and Make Payment

```typescript
// Get smart account address
const accountAddress = await gaslessClient.getAccountAddress();
console.log("Smart Account:", accountAddress);

// Check USDT0 balance
const balance = await gaslessClient.getFormattedBalance();
console.log("Balance:", balance, "USDT0");

// Check if payment can be sponsored (free gas)
const sponsorInfo = await gaslessClient.canSponsor({
  to: "0xRecipientAddress",
  amount: 1_000000n, // 1 USDT0
});

if (!sponsorInfo.canSponsor) {
  console.log("Payment won't be sponsored:", sponsorInfo.reason);
}

// Execute gasless payment
const result = await gaslessClient.pay({
  to: "0xRecipientAddress",
  amount: 1_000000n, // 1 USDT0 (6 decimals)
});

console.log("UserOp Hash:", result.userOpHash);
console.log("Sponsored:", result.sponsored); // true if gas was free

// Wait for confirmation
const receipt = await result.wait();
console.log("Transaction Hash:", receipt.txHash);
console.log("Success:", receipt.success);
```

### Step 4: Batch Payments

```typescript
// Send to multiple recipients in one transaction
const batchResult = await gaslessClient.payBatch({
  payments: [
    { to: "0xAlice", amount: 1_000000n },   // 1 USDT0
    { to: "0xBob", amount: 2_000000n },     // 2 USDT0
    { to: "0xCharlie", amount: 500000n },   // 0.5 USDT0
  ],
});

// All payments are atomic - either all succeed or all fail
const receipt = await batchResult.wait();
```

---

## Cross-Chain Bridging

Bridge USDT0 between supported chains using LayerZero.

### Supported Chains

| Chain | Chain ID | LayerZero EID |
|-------|----------|---------------|
| Ethereum | 1 | 30101 |
| Arbitrum | 42161 | 30110 |
| Ink | 57073 | 30291 |
| Berachain | 80084 | 30362 |
| Unichain | 130 | 30320 |

### Step 1: Install Dependencies

```bash
pnpm add @t402/evm viem
```

### Step 2: Create Bridge Client

```typescript
import { Usdt0Bridge, LayerZeroScanClient } from "@t402/evm";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";

// Create wallet client
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(),
});

// Create bridge client
const bridge = new Usdt0Bridge(walletClient, "arbitrum");
```

### Step 3: Get Bridge Quote

```typescript
// Get quote for bridging
const quote = await bridge.quote({
  fromChain: "arbitrum",
  toChain: "ethereum",
  amount: 100_000000n, // 100 USDT0
  recipient: account.address, // Can be different from sender
});

console.log("Native Fee:", quote.nativeFee, "wei");
console.log("LayerZero Fee:", quote.lzFee);
```

### Step 4: Execute Bridge

```typescript
// Execute the bridge transaction
const result = await bridge.send({
  fromChain: "arbitrum",
  toChain: "ethereum",
  amount: 100_000000n,
  recipient: account.address,
});

console.log("Source TX:", result.txHash);
console.log("Message GUID:", result.messageGuid);
```

### Step 5: Track Delivery

```typescript
// Create LayerZero Scan client
const scanClient = new LayerZeroScanClient();

// Wait for delivery with status updates
const delivery = await scanClient.waitForDelivery(result.messageGuid, {
  onStatusChange: (status) => {
    console.log("Status:", status);
    // INFLIGHT -> CONFIRMING -> DELIVERED
  },
  timeout: 600000, // 10 minutes
  pollingInterval: 10000, // 10 seconds
});

console.log("Delivery Success:", delivery.success);
console.log("Destination TX:", delivery.dstTxHash);
```

---

## AI Agent Payments with MCP

Enable AI agents like Claude to make payments.

### Step 1: Install MCP Server

```bash
npm install -g @t402/mcp
# or run directly
npx @t402/mcp
```

### Step 2: Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent:

```json
{
  "mcpServers": {
    "t402": {
      "command": "npx",
      "args": ["@t402/mcp"],
      "env": {
        "T402_PRIVATE_KEY": "0x...",
        "T402_DEMO_MODE": "false"
      }
    }
  }
}
```

### Step 3: Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `T402_PRIVATE_KEY` | Wallet private key | Yes (unless demo mode) |
| `T402_DEMO_MODE` | Enable demo mode (no real txs) | No (default: false) |
| `T402_BUNDLER_URL` | ERC-4337 bundler URL | No |
| `T402_PAYMASTER_URL` | Paymaster URL for gasless | No |

### Step 4: Available MCP Tools

Once configured, Claude can use these tools:

| Tool | Description |
|------|-------------|
| `t402/getBalance` | Check wallet balance on specific network |
| `t402/getAllBalances` | Check balances across all networks |
| `t402/pay` | Execute stablecoin payment |
| `t402/payGasless` | Execute gasless payment via ERC-4337 |
| `t402/getBridgeFee` | Get USDT0 bridge fee quote |
| `t402/bridge` | Bridge USDT0 between chains |

### Step 5: Example Prompts

Try these prompts with Claude:

- "Check my USDC balance on Base"
- "Show my balances across all chains"
- "Send 10 USDC to 0x... on Arbitrum"
- "How much does it cost to bridge 100 USDT0 from Arbitrum to Ethereum?"
- "Bridge 50 USDT0 from Arbitrum to Ethereum"

### Step 6: Programmatic Usage

```typescript
import { executeGetBalance, executePay, executeBridge } from "@t402/mcp";

// Check balance
const balance = await executeGetBalance({
  network: "base",
  address: "0x...",
});

// Execute payment
const payResult = await executePay(
  {
    to: "0x...",
    amount: "10.00",
    token: "USDC",
    network: "base",
  },
  {
    privateKey: process.env.PRIVATE_KEY!,
    demoMode: false,
  }
);

// Bridge tokens
const bridgeResult = await executeBridge(
  {
    fromChain: "arbitrum",
    toChain: "ethereum",
    amount: "100",
    recipient: "0x...",
  },
  {
    privateKey: process.env.PRIVATE_KEY!,
  }
);
```

---

## Next Steps

- [API Reference](https://docs.t402.io/api)
- [Example Projects](../examples/)
- [Protocol Specification](../specs/)
- [Contributing Guide](../CONTRIBUTING.md)
