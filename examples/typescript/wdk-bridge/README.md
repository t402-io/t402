# @t402/wdk-bridge Example

Cross-chain USDT0 bridging with Tether WDK and LayerZero OFT.

## Features

- **Multi-chain balance management**: View USDT0 balances across all configured chains
- **Automatic route selection**: Finds the best source chain based on balances and fees
- **Fee-optimized routing**: Choose strategy - cheapest, fastest, or preferred
- **LayerZero tracking**: Monitor bridge transactions via LayerZero Scan API

## Supported Chains

| Chain | Chain ID | LayerZero EID |
|-------|----------|---------------|
| Ethereum | 1 | 30101 |
| Arbitrum | 42161 | 30110 |
| Ink | 57073 | 30291 |
| Berachain | 80084 | 30362 |
| Unichain | 130 | 30320 |

## Installation

```bash
pnpm install
```

## Running the Demo

```bash
pnpm start
```

## Usage

```typescript
import { WdkBridgeClient } from '@t402/wdk-bridge';

// Create bridge client with WDK accounts for multiple chains
const bridge = new WdkBridgeClient({
  accounts: {
    ethereum: ethereumWdkAccount,
    arbitrum: arbitrumWdkAccount,
  },
  defaultStrategy: 'cheapest',
});

// Get multi-chain balances
const summary = await bridge.getBalances();
console.log('Total USDT0:', summary.totalUsdt0);

// Auto-bridge with best route selection
const result = await bridge.autoBridge({
  toChain: 'ethereum',
  amount: 100_000000n, // 100 USDT0
  recipient: '0x...',
});

// Wait for delivery
const delivery = await result.waitForDelivery({
  onStatusChange: (status) => console.log('Status:', status),
});

console.log('Delivered!', delivery.dstTxHash);
```

## Route Strategies

- **cheapest** (default): Select route with lowest native fee
- **fastest**: Select route with fastest estimated delivery
- **preferred**: Use preferred source chain if available, fallback to cheapest

## Estimated Bridge Times

| Route | Time |
|-------|------|
| Ethereum -> Arbitrum | ~3 minutes |
| Arbitrum -> Ethereum | ~15 minutes |
| L2 -> L2 | ~5 minutes |

## Requirements

- Tether WDK accounts (from `@tetherto/wdk`)
- USDT0 tokens on at least one chain
- Native tokens for gas fees (LayerZero fees)

## Related Packages

- [@t402/wdk](../../typescript/packages/wdk) - Tether WDK integration
- [@t402/wdk-gasless](../../typescript/packages/wdk-gasless) - Gasless payments
- [@t402/evm](../../typescript/packages/mechanisms/evm) - EVM bridge implementation
