# t402 TypeScript SDK

[![npm](https://img.shields.io/npm/v/@t402/core?label=npm%20%40t402%2Fcore)](https://www.npmjs.com/package/@t402/core)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/t402-io/t402/blob/main/LICENSE)

> **Version 2.0.0** - TypeScript implementation of the [t402 Payment Protocol](https://t402.io).

## Installation

```bash
# Core packages
pnpm add @t402/core @t402/evm

# Server frameworks
pnpm add @t402/express   # Express.js
pnpm add @t402/next      # Next.js
pnpm add @t402/hono      # Hono
pnpm add @t402/fastify   # Fastify

# Client libraries
pnpm add @t402/fetch     # Fetch API
pnpm add @t402/axios     # Axios

# UI components
pnpm add @t402/paywall   # Universal paywall
pnpm add @t402/react     # React hooks/components
pnpm add @t402/vue       # Vue composables/components

# WDK (gasless payments, bridging)
pnpm add @t402/wdk-gasless  # ERC-4337
pnpm add @t402/wdk-bridge   # LayerZero
pnpm add @t402/wdk-multisig # Safe multi-sig

# CLI tool
pnpm add -g @t402/cli
```

## Package Architecture

```
@t402/core              Core types, client, server, facilitator abstractions
@t402/extensions        Bazaar, Sign-In-With-X extensions

Mechanisms (Chain-specific payment implementations):
@t402/evm               EIP-3009, ERC-4337, USDT0 bridge for EVM chains
@t402/svm               Solana SPL token support
@t402/ton               TON Jetton (TEP-74) support
@t402/tron              TRON TRC-20 support

HTTP Integrations:
@t402/express           Express.js middleware
@t402/hono              Hono middleware
@t402/fastify           Fastify middleware
@t402/next              Next.js integration
@t402/fetch             Fetch API wrapper
@t402/axios             Axios interceptor

UI Components:
@t402/paywall           Universal payment wall
@t402/react             React hooks and components
@t402/vue               Vue composables and components

WDK (Wallet Development Kit):
@t402/wdk               Tether WDK integration
@t402/wdk-gasless       ERC-4337 gasless payments
@t402/wdk-bridge        LayerZero cross-chain bridging
@t402/wdk-multisig      Safe multi-sig support

Tools:
@t402/mcp               AI Agent MCP server
@t402/cli               Command-line tools
```

## Quick Start

### Client (Make Payments)

```typescript
import { t402Client, wrapFetchWithPayment } from "@t402/fetch";
import { registerExactEvmScheme } from "@t402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const client = new t402Client();

registerExactEvmScheme(client, {
  signer: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
});

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const response = await fetchWithPayment("https://api.example.com/data");
```

### Server (Require Payments)

```typescript
import express from "express";
import { paymentMiddleware, t402ResourceServer } from "@t402/express";
import { ExactEvmScheme } from "@t402/evm/exact/server";

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /api/data": {
        accepts: [
          { scheme: "exact", price: "$0.01", network: "eip155:8453", payTo: "0x..." },
        ],
        description: "Premium API data",
      },
    },
    new t402ResourceServer(facilitatorClient)
      .register("eip155:8453", new ExactEvmScheme()),
  ),
);
```

### Gasless Payments (ERC-4337)

```typescript
import { SafeSmartAccount, createBundlerClient, createPaymaster } from "@t402/evm/erc4337";

const safeAccount = new SafeSmartAccount({
  owner: privateKeyToAccount(ownerPrivateKey),
  chainId: 8453,
});

const bundler = createBundlerClient({ provider: "pimlico", apiKey, chainId: 8453 });
const paymaster = createPaymaster({ provider: "pimlico", apiKey, chainId: 8453 });

const callData = safeAccount.encodeExecute(targetAddress, 0n, data);
const userOp = await bundler.buildUserOperation({ sender: smartAccountAddress, callData });
const hash = await bundler.sendUserOperation({ ...userOp, signature });
```

### Cross-Chain Bridge

```typescript
import { Usdt0Bridge, LayerZeroScanClient } from "@t402/evm";

const bridge = new Usdt0Bridge(signer, "arbitrum");

const quote = await bridge.quote({
  fromChain: "arbitrum",
  toChain: "ethereum",
  amount: 100_000000n,
  recipient: "0x...",
});

const result = await bridge.send({ ...quote });

const scanClient = new LayerZeroScanClient();
await scanClient.waitForDelivery(result.messageGuid);
```

### MCP Server (AI Agents)

```bash
# Run MCP server
npx @t402/mcp

# Claude Desktop config
{
  "mcpServers": {
    "t402": {
      "command": "npx",
      "args": ["@t402/mcp"],
      "env": { "T402_DEMO_MODE": "true" }
    }
  }
}
```

## Supported Networks

| Chain | Token | CAIP-2 Identifier |
|-------|-------|-------------------|
| Ethereum | USDT0 | `eip155:1` |
| Base | USDT0 | `eip155:8453` |
| Arbitrum | USDT0 | `eip155:42161` |
| Optimism | USDT0 | `eip155:10` |
| Ink | USDT0 | `eip155:57073` |
| Solana | USDC | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| TON | USDT | `ton:mainnet` |
| TRON | USDT | `tron:mainnet` |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Type checking
pnpm typecheck
```

## Monorepo Structure

```
typescript/
├── packages/
│   ├── core/           # @t402/core
│   ├── extensions/     # @t402/extensions
│   ├── mechanisms/     # @t402/evm, @t402/svm, @t402/ton, @t402/tron
│   ├── http/           # @t402/express, @t402/next, @t402/hono, etc.
│   ├── wdk/            # @t402/wdk
│   ├── wdk-gasless/    # @t402/wdk-gasless
│   ├── wdk-bridge/     # @t402/wdk-bridge
│   ├── wdk-multisig/   # @t402/wdk-multisig
│   ├── mcp/            # @t402/mcp
│   └── cli/            # @t402/cli
├── site/               # Documentation website
└── pnpm-workspace.yaml
```

## License

Apache 2.0 - See [LICENSE](../LICENSE) for details.
