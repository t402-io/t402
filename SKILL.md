---
name: t402
version: 2.8.0
description: HTTP-native stablecoin payment protocol for AI agents
author: t402-io
license: Apache-2.0
capabilities:
  - pay
  - verify
  - bridge
  - swap
  - sign
  - observe
tags:
  - payment
  - stablecoin
  - blockchain
  - http-402
  - ai-agent
  - mcp
---

# t402 Payment Skill

> Teach your AI agent to pay for web resources using USDT/USDC stablecoins across 25+ blockchain networks.

## What You Can Do

- **Pay for HTTP resources** — automatically handle 402 Payment Required responses
- **Check balances** — query wallet balances across all supported networks
- **Bridge tokens** — move USDT0 between chains via LayerZero
- **Swap tokens** — exchange tokens via DEX aggregators
- **Verify agents** — check ERC-8004 on-chain identity and reputation
- **Monitor payments** — track payment flows and metrics

## How HTTP 402 Payment Works

```
1. Request a resource:     GET https://api.example.com/data
2. Receive 402 response:   { amount: "1000000", asset: "USDC", network: "eip155:8453" }
3. Sign payment:           EIP-3009 TransferWithAuthorization (gasless)
4. Retry with payment:     GET /data + PAYMENT-SIGNATURE header
5. Receive resource:       200 OK + data
```

The entire flow happens in a single request-response cycle. No accounts, API keys, or checkout flows needed.

## Available MCP Tools

### Core Payment (always available)
| Tool | Description |
|------|-------------|
| `t402/getBalance` | Get token balances on a specific network |
| `t402/getAllBalances` | Get balances across all networks |
| `t402/pay` | Execute a stablecoin payment |
| `t402/payGasless` | Pay without gas (ERC-4337) |
| `t402/getTokenPrice` | Get current token prices |
| `t402/getGasPrice` | Get gas prices per network |
| `t402/estimatePaymentFee` | Estimate payment cost |
| `t402/compareNetworkFees` | Find cheapest network |
| `t402/getBridgeFee` | Quote a cross-chain bridge |
| `t402/bridge` | Execute cross-chain transfer |
| `t402/quoteBridge` | Get reusable bridge quote |
| `t402/executeBridgeQuote` | Execute from quote |

### WDK Wallet (requires seed phrase)
| Tool | Description |
|------|-------------|
| `wdk/getWallet` | Get wallet info |
| `wdk/getBalances` | Multi-chain balances |
| `wdk/transfer` | Send stablecoins |
| `wdk/swap` | Swap tokens (Velora) |
| `wdk/quoteSwap` | Get swap quote |
| `wdk/executeSwap` | Execute from quote |
| `t402/autoPay` | **Smart auto-payment** — fetch URL, handle 402, pay, return content |

### Agent Identity (ERC-8004)
| Tool | Description |
|------|-------------|
| `erc8004/resolveAgent` | Look up agent identity |
| `erc8004/checkReputation` | Query reputation score |
| `erc8004/verifyWallet` | Verify payment address |

### Unified (advanced)
| Tool | Description |
|------|-------------|
| `t402/smartPay` | Intelligent payment routing |
| `t402/paymentPlan` | Multi-step payment planning |

## Supported Networks

### EVM (25 mainnet chains)
Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, BNB, Berachain, Celo, Ink, Unichain, MegaETH, Flare, Kaia, Mantle, Sei, Conflux, Monad, Rootstock, XLayer, Fantom, HyperEVM, Plasma, Stable, Corn

### Non-EVM
Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, Cosmos, Bitcoin, Lightning, Stellar, Spark

### Supported Tokens
- **USDT0** — Tether omnichain (EIP-3009, gasless)
- **USDC** — USD Coin (EIP-3009)
- **USDT** — Legacy Tether (approve+transferFrom)
- **USAT** — Tether America USD

## Security Rules

1. **Always confirm before payment** — never auto-execute without user approval
2. **Never expose seed phrases** — use environment variables
3. **Verify recipients** — use `erc8004/verifyWallet` before paying unknown agents
4. **Set spending limits** — use the policy engine for budget enforcement
5. **Check prices first** — use `t402/estimatePaymentFee` before committing

## Quick Start

### As an AI Agent (MCP)
```bash
npm install @t402/mcp
```

Configure in your MCP client with a WDK seed phrase. The `t402/autoPay` tool handles the entire 402 flow automatically.

### Programmatic (TypeScript)
```typescript
import { createT402Client, wrapFetchWithPayment } from "@t402/core";

const client = createT402Client({ signer: myWallet });
const fetch402 = wrapFetchWithPayment(fetch, client);

// Just fetch — payment happens automatically on 402
const data = await fetch402("https://paid-api.example.com/data");
```

## Learn More

- [Documentation](https://docs.t402.io)
- [GitHub](https://github.com/t402-io/t402)
- [Demo](https://demo.t402.io)
- [Protocol Spec](https://t402.io)
