# @t402/wdk-gasless Example

This example demonstrates how to use the `@t402/wdk-gasless` package for gasless USDT0 payments using Tether WDK and ERC-4337 Account Abstraction.

## Features

- **Gasless Payments**: Send USDT0 without holding ETH for gas
- **Smart Accounts**: Automatic Safe smart account creation
- **Batch Payments**: Send multiple payments in one transaction
- **Sponsored Transactions**: Check if payments can be gas-sponsored

## Prerequisites

1. Tether WDK account (`@tetherto/wdk`)
2. Bundler API key (e.g., [Pimlico](https://pimlico.io), [Alchemy](https://alchemy.com), [Stackup](https://stackup.sh))
3. Paymaster API key (for sponsored transactions)

## Setup

```bash
# From this directory
pnpm install
```

## Run Demo

```bash
pnpm start
```

## Usage Example

```typescript
import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';
import { createWdkGaslessClient } from '@t402/wdk-gasless';

// Create public client
const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

// Create gasless client
const client = await createWdkGaslessClient({
  wdkAccount: myWdkAccount, // From @tetherto/wdk
  publicClient,
  chainId: 42161, // Arbitrum
  bundler: {
    bundlerUrl: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=...',
    chainId: 42161,
  },
  paymaster: {
    address: '0x...', // Paymaster contract address
    url: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=...',
    type: 'sponsoring',
  },
});

// Execute gasless payment
const result = await client.pay({
  to: '0x...', // Recipient
  amount: 1000000n, // 1 USDT0 (6 decimals)
});

// Wait for confirmation
const receipt = await result.wait();
console.log('Transaction confirmed:', receipt.txHash);
```

## API Reference

### `createWdkGaslessClient(config)`

Creates a new gasless client.

| Parameter | Type | Description |
|-----------|------|-------------|
| `wdkAccount` | `WdkAccount` | Tether WDK account |
| `publicClient` | `PublicClient` | Viem public client |
| `chainId` | `number` | Chain ID |
| `bundler` | `BundlerConfig` | Bundler configuration |
| `paymaster` | `PaymasterConfig` | Optional paymaster for gas sponsorship |

### `client.pay(params)`

Executes a gasless payment.

| Parameter | Type | Description |
|-----------|------|-------------|
| `to` | `Address` | Recipient address |
| `amount` | `bigint` | Amount to send |
| `token` | `"USDT0" \| "USDC" \| Address` | Token to send (default: USDT0) |

### `client.payBatch(params)`

Executes multiple payments in a single transaction.

| Parameter | Type | Description |
|-----------|------|-------------|
| `payments` | `Array<{to, amount, token}>` | List of payments |

### `client.canSponsor(params)`

Checks if a payment can be sponsored (free gas).

Returns `{ canSponsor: boolean, reason?: string, estimatedGasCost?: bigint }`

## Supported Chains

| Chain | Chain ID | USDT0 Available |
|-------|----------|-----------------|
| Ethereum | 1 | ✅ |
| Arbitrum | 42161 | ✅ |
| Base | 8453 | ✅ |
| Optimism | 10 | ✅ |
| Ink | 57073 | ✅ |
| Berachain | 80084 | ✅ |
| Unichain | 130 | ✅ |
