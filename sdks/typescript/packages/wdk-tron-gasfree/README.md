# @t402/wdk-tron-gasfree

Gas-free USDT payments on TRON using [Tether WDK](https://github.com/nicetester/wdk-docs).

## Overview

This package enables users to send TRC20 USDT payments on TRON without holding any TRX for bandwidth/energy costs. Transaction fees are sponsored through Tether's gas-free relay service.

## Installation

```bash
npm install @t402/wdk-tron-gasfree
# Peer dependencies
npm install @tetherto/wdk @tetherto/wdk-wallet-tron-gasfree
```

## Usage

```typescript
import { createWdkTronGasfreeClient } from '@t402/wdk-tron-gasfree';

// Create the client with your WDK tron-gasfree wallet instance
const client = await createWdkTronGasfreeClient({
  wdkInstance: myTronGasfreeWallet,
});

// Check USDT balance
const balance = await client.getBalance();
const formatted = client.getFormattedBalance(balance);
console.log(`USDT Balance: ${formatted}`);

// Execute gas-free payment
const result = await client.pay({
  to: 'TRecipientAddress...',
  amount: 1000000n, // 1 USDT (6 decimals)
});

console.log('Transaction ID:', result.txId);
console.log('Gas-free:', result.sponsored); // always true

// Check if gas-free is available
const canSponsor = await client.canSponsor({
  to: 'TRecipientAddress...',
  amount: 1000000n,
});
console.log('Can sponsor:', canSponsor);
```

## Supported Tokens

| Token | Network | Address |
|-------|---------|---------|
| USDT  | Mainnet | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |
| USDT0 | Mainnet | `TKiUqMmnCBPqRfREwNExNYKG2KQqj5Gd2m` |
| USDT  | Shasta  | `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs` |

## API

### `createWdkTronGasfreeClient(config)`

Creates a new gas-free client.

### `client.pay(params)`

Execute a gas-free TRC20 USDT transfer.

### `client.getBalance(token?)`

Check USDT balance (returns `bigint`).

### `client.getFormattedBalance(balance, decimals?)`

Format a balance for display.

### `client.getAddress()`

Get the wallet address.

### `client.canSponsor(params)`

Check if a gas-free transfer is available.

## License

Apache-2.0
