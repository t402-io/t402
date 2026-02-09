# USDT0 Cross-Chain Bridge Example

This example demonstrates how to bridge USDT0 across EVM chains using LayerZero OFT (Omnichain Fungible Token) via `@t402/evm`.

## Features

- **Chain Discovery**: List supported bridging chains
- **Quote**: Get bridge fees and estimated delivery time
- **Send**: Execute cross-chain USDT0 transfers
- **Track**: Monitor delivery status via LayerZero Scan
- **Cross-Chain Router**: Automatic bridge + payment in one step

## Prerequisites

- Node.js 18+
- Private key with USDT0 balance on the source chain
- Native token (ETH/etc.) for gas fees on the source chain

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Run in demo mode (no wallet required):

```bash
pnpm tsx index.ts
```

3. Run with real transactions:

```bash
PRIVATE_KEY=0x... pnpm tsx index.ts
```

Set `DEMO_MODE = false` in `index.ts` to enable real transactions.

## Supported Chains

| Chain | USDT0 Address |
|-------|---------------|
| Ethereum | `0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee` |
| Arbitrum | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` |
| Ink | `0x0200C29006150606B650577BBE7B6248F58470c1` |
| Berachain | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| Unichain | `0x9151434b16b9763660705744891fA906F660EcC5` |

## Code Overview

### 1. Get Bridge Quote

```typescript
import { Usdt0Bridge } from "@t402/evm";

const bridge = new Usdt0Bridge(signer, "arbitrum");

const quote = await bridge.quote({
  fromChain: "arbitrum",
  toChain: "ethereum",
  amount: 100_000000n, // 100 USDT0
  recipient: "0x...",
});

console.log("Fee:", quote.nativeFee, "wei");
console.log("ETA:", quote.estimatedTime, "seconds");
```

### 2. Execute Bridge

```typescript
const result = await bridge.send({
  fromChain: "arbitrum",
  toChain: "ethereum",
  amount: 100_000000n,
  recipient: "0x...",
  slippageTolerance: 0.5,
});

console.log("TX:", result.txHash);
console.log("GUID:", result.messageGuid);
```

### 3. Track Delivery

```typescript
import { LayerZeroScanClient } from "@t402/evm";

const scanClient = new LayerZeroScanClient();

const message = await scanClient.waitForDelivery(result.messageGuid, {
  timeout: 600000,
  onStatusChange: (status) => console.log("Status:", status),
});

console.log("Delivered! Dest TX:", message.dstTxHash);
```

### 4. Cross-Chain Payment Router

Bridge and pay in a single step:

```typescript
import { CrossChainPaymentRouter } from "@t402/evm";

const router = new CrossChainPaymentRouter(signer, "arbitrum");

const paymentResult = await router.routePayment({
  sourceChain: "arbitrum",
  destinationChain: "ethereum",
  amount: 100_000000n,
  payTo: recipientAddress,
  payer: userAddress,
});

await router.waitForDelivery(paymentResult.messageGuid);
```

## Resources

- [LayerZero Scan](https://layerzeroscan.com/) - Message tracking
- [USDT0 Documentation](https://usdt0.to/) - OFT token details
- [T402 Bridge Docs](https://docs.t402.io/reference/bridge) - SDK reference
