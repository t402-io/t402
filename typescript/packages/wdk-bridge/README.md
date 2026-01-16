# @t402/wdk-bridge

Cross-chain USDT0 bridging with Tether WDK and LayerZero.

## Features

- **Multi-Chain Bridging**: Bridge USDT0 between Ethereum, Arbitrum, Ink, Berachain, and Unichain
- **Auto-Routing**: Automatic source chain selection based on balance and fees
- **Route Strategies**: Choose cheapest, fastest, or preferred chain
- **Delivery Tracking**: Track bridge status via LayerZero Scan
- **Balance Management**: Query USDT0 balances across all configured chains

## Installation

```bash
npm install @t402/wdk-bridge
# or
pnpm add @t402/wdk-bridge
```

### Peer Dependencies

```bash
npm install @tetherto/wdk @tetherto/wdk-wallet-evm
```

## Quick Start

```typescript
import { WdkBridgeClient } from '@t402/wdk-bridge';

// Create client with WDK accounts for multiple chains
const bridge = new WdkBridgeClient({
  accounts: {
    ethereum: ethereumWdkAccount,
    arbitrum: arbitrumWdkAccount,
  },
  defaultStrategy: 'cheapest',
});

// Get balances across all chains
const summary = await bridge.getBalances();
console.log(`Total USDT0: ${summary.totalUsdt0}`);

// Auto-bridge from the best source chain
const result = await bridge.autoBridge({
  toChain: 'ethereum',
  amount: 100_000000n, // 100 USDT0
  recipient: '0xRecipientAddress...',
});

// Wait for delivery
const delivery = await result.waitForDelivery();
if (delivery.success) {
  console.log(`Delivered! Destination tx: ${delivery.dstTxHash}`);
}
```

## API Reference

### `WdkBridgeClient`

#### Constructor

```typescript
interface WdkBridgeClientConfig {
  accounts: Record<string, WdkAccount>;  // Chain name -> WDK account
  defaultStrategy?: RouteStrategy;       // 'cheapest' | 'fastest' | 'preferred'
  defaultSlippage?: number;              // Default: 0.5 (0.5%)
}

const bridge = new WdkBridgeClient(config);
```

#### `autoBridge(params): Promise<WdkBridgeResult>`

Execute a bridge with automatic source chain selection.

```typescript
interface AutoBridgeParams {
  toChain: string;               // Destination chain
  amount: bigint;                // Amount in USDT0 decimals (6)
  recipient: Address;            // Recipient address on destination
  preferredSourceChain?: string; // Optional preferred source
  slippageTolerance?: number;    // Slippage tolerance (default: 0.5%)
}

interface WdkBridgeResult {
  txHash: Hex;              // Source transaction hash
  messageGuid: string;      // LayerZero message GUID
  amountSent: bigint;       // Amount sent
  amountToReceive: bigint;  // Expected amount to receive
  fromChain: string;        // Source chain
  toChain: string;          // Destination chain
  estimatedTime: number;    // Estimated delivery time (seconds)
  waitForDelivery(options?: WaitOptions): Promise<DeliveryResult>;
}
```

#### `bridge(params): Promise<WdkBridgeResult>`

Execute a bridge from a specific chain.

```typescript
await bridge.bridge({
  fromChain: 'arbitrum',
  toChain: 'ethereum',
  amount: 50_000000n,
  recipient: '0x...',
});
```

#### `getRoutes(toChain, amount): Promise<BridgeRoute[]>`

Get all available routes to a destination.

```typescript
interface BridgeRoute {
  fromChain: string;
  toChain: string;
  nativeFee: bigint;         // Fee in native token
  amountToSend: bigint;
  minAmountToReceive: bigint;
  estimatedTime: number;     // Seconds
  available: boolean;
  unavailableReason?: string;
}
```

#### `getBalances(): Promise<BalanceSummary>`

Get USDT0 balances across all configured chains.

```typescript
interface BalanceSummary {
  balances: ChainBalance[];
  totalUsdt0: bigint;
  chainsWithBalance: string[];
  bridgeableChains: string[];  // Chains with enough for bridge minimum
}

interface ChainBalance {
  chain: string;
  chainId: number;
  usdt0Balance: bigint;
  nativeBalance: bigint;
  canBridge: boolean;
}
```

#### `getChainBalance(chain): Promise<ChainBalance>`

Get balance for a specific chain.

#### `trackMessage(guid): Promise<Message>`

Track a LayerZero message by GUID.

#### `waitForDelivery(guid, options): Promise<Message>`

Wait for a message to be delivered.

## Supported Chains

| Chain | Chain ID | LayerZero EID |
|-------|----------|---------------|
| Ethereum | 1 | 30101 |
| Arbitrum | 42161 | 30110 |
| Ink | 57073 | 30291 |
| Berachain | 80084 | 30362 |
| Unichain | 130 | 30320 |

## Route Strategies

| Strategy | Description |
|----------|-------------|
| `cheapest` | Select route with lowest native fee (default) |
| `fastest` | Select route with shortest estimated time |
| `preferred` | Use preferred chain if available, fallback to cheapest |

## Estimated Bridge Times

| Route | Time |
|-------|------|
| L1 -> L2 (Ethereum -> Arbitrum) | ~3 minutes |
| L2 -> L1 (Arbitrum -> Ethereum) | ~15 minutes |
| L2 -> L2 (Cross-L2) | ~5 minutes |

## Constants

```typescript
import {
  BRIDGE_CHAINS,
  USDT0_ADDRESSES,
  CHAIN_IDS,
  MIN_BRIDGE_AMOUNT,
  DEFAULT_SLIPPAGE,
  supportsBridging,
  getUsdt0Address,
  getChainId,
  getEstimatedBridgeTime,
} from '@t402/wdk-bridge';

// Minimum bridge amount (1 USDT0)
console.log(MIN_BRIDGE_AMOUNT); // 1_000000n

// Check if chain supports bridging
supportsBridging('arbitrum'); // true
supportsBridging('polygon');  // false

// Get USDT0 address
getUsdt0Address('ethereum');
// '0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee'
```

## Examples

### Balance Overview

```typescript
const bridge = new WdkBridgeClient({
  accounts: {
    ethereum: ethAccount,
    arbitrum: arbAccount,
    ink: inkAccount,
  },
});

const summary = await bridge.getBalances();
console.log(`Total USDT0: ${summary.totalUsdt0 / 1_000000n} USDT0`);
console.log(`Chains with balance: ${summary.chainsWithBalance.join(', ')}`);
console.log(`Bridgeable from: ${summary.bridgeableChains.join(', ')}`);
```

### Route Comparison

```typescript
const routes = await bridge.getRoutes('ethereum', 100_000000n);

for (const route of routes) {
  if (route.available) {
    console.log(
      `${route.fromChain} -> ${route.toChain}: ` +
      `fee=${route.nativeFee}, time=${route.estimatedTime}s`
    );
  } else {
    console.log(`${route.fromChain}: ${route.unavailableReason}`);
  }
}
```

### Delivery Tracking

```typescript
const result = await bridge.autoBridge({
  toChain: 'ethereum',
  amount: 50_000000n,
  recipient: '0x...',
});

console.log(`Bridge initiated: ${result.txHash}`);
console.log(`Message GUID: ${result.messageGuid}`);
console.log(`Expected delivery: ${result.estimatedTime}s`);

// Track delivery with status updates
const delivery = await result.waitForDelivery({
  timeout: 600_000,  // 10 minutes
  pollInterval: 10_000,  // 10 seconds
  onStatusChange: (status) => {
    console.log(`Status: ${status}`);
  },
});

if (delivery.success) {
  console.log(`Delivered in tx: ${delivery.dstTxHash}`);
} else {
  console.log(`Failed: ${delivery.error}`);
}
```

### Custom RPC URLs

```typescript
const bridge = new WdkBridgeClient({
  accounts: { arbitrum: arbAccount },
});

// Set custom RPC URL
bridge.setRpcUrl('arbitrum', 'https://arb1.arbitrum.io/rpc');
```

## License

Apache-2.0
