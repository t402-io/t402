# @t402/wdk-gasless

Gasless USDT0 payments with Tether WDK and ERC-4337 Account Abstraction.

## Features

- **Gasless Payments**: Send USDT0/USDC without paying gas fees
- **ERC-4337 Integration**: Uses Safe smart accounts with Account Abstraction
- **Batch Payments**: Execute multiple transfers in a single transaction
- **Multi-Chain Support**: Ethereum, Arbitrum, Base, Optimism, Ink, Berachain, Unichain
- **Paymaster Sponsorship**: Optional gas sponsorship via paymasters

## Installation

```bash
npm install @t402/wdk-gasless
# or
pnpm add @t402/wdk-gasless
```

### Peer Dependencies

```bash
npm install @tetherto/wdk @tetherto/wdk-wallet-evm
```

## Quick Start

```typescript
import { createWdkGaslessClient } from '@t402/wdk-gasless';
import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';

// Create a public client
const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

// Create the gasless client
const client = await createWdkGaslessClient({
  wdkAccount: myWdkAccount, // From @tetherto/wdk
  publicClient,
  chainId: 42161, // Arbitrum
  bundler: {
    bundlerUrl: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=YOUR_KEY',
    chainId: 42161,
  },
  paymaster: {
    address: '0x...',
    url: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=YOUR_KEY',
    type: 'sponsoring',
  },
});

// Execute a gasless payment
const result = await client.pay({
  to: '0xRecipientAddress...',
  amount: 1000000n, // 1 USDT0 (6 decimals)
});

// Wait for confirmation
const receipt = await result.wait();
console.log('Payment confirmed:', receipt.txHash);
```

## API Reference

### `createWdkGaslessClient(config)`

Creates a new gasless payment client.

```typescript
interface CreateWdkGaslessClientConfig {
  wdkAccount: WdkAccount;        // WDK account from @tetherto/wdk
  publicClient: PublicClient;    // Viem public client
  chainId: number;               // Chain ID
  bundler: BundlerConfig;        // Bundler configuration
  paymaster?: PaymasterConfig;   // Optional paymaster for gas sponsorship
  saltNonce?: bigint;            // Salt for address generation (default: 0n)
}
```

### `WdkGaslessClient`

#### `pay(params): Promise<GaslessPaymentResult>`

Execute a single gasless payment.

```typescript
interface GaslessPaymentParams {
  to: Address;                              // Recipient address
  amount: bigint;                           // Amount in token decimals
  token?: 'USDT0' | 'USDC' | Address;       // Token (default: 'USDT0')
}

interface GaslessPaymentResult {
  userOpHash: Hex;      // UserOperation hash
  sender: Address;      // Smart account address
  sponsored: boolean;   // Whether gas was sponsored
  wait(): Promise<GaslessPaymentReceipt>;
}
```

#### `payBatch(params): Promise<GaslessPaymentResult>`

Execute multiple payments in a single transaction.

```typescript
interface BatchPaymentParams {
  payments: Array<{
    to: Address;
    amount: bigint;
    token?: 'USDT0' | 'USDC' | Address;
  }>;
}
```

#### `canSponsor(params): Promise<SponsorshipInfo>`

Check if a payment can be gas-sponsored.

```typescript
interface SponsorshipInfo {
  canSponsor: boolean;
  reason?: string;
  estimatedGasCost?: bigint;
}
```

#### `getBalance(token?): Promise<bigint>`

Get the token balance of the smart account.

#### `getFormattedBalance(token?, decimals?): Promise<string>`

Get the formatted token balance (human-readable).

#### `getAccountAddress(): Promise<Address>`

Get the smart account address.

#### `isAccountDeployed(): Promise<boolean>`

Check if the smart account is deployed on-chain.

## Supported Chains

| Chain | Chain ID | USDT0 | USDC |
|-------|----------|-------|------|
| Ethereum | 1 | ✅ | ✅ |
| Arbitrum | 42161 | ✅ | ✅ |
| Base | 8453 | ✅ | ✅ |
| Optimism | 10 | ✅ | ✅ |
| Ink | 57073 | ✅ | - |
| Berachain | 80084 | ✅ | - |
| Unichain | 130 | ✅ | - |

## Constants

```typescript
import {
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  CHAIN_IDS,
  getTokenAddress,
  getChainName,
} from '@t402/wdk-gasless';

// Get USDT0 address on Arbitrum
const usdt0 = USDT0_ADDRESSES.arbitrum;
// '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'

// Get chain name from ID
const chainName = getChainName(42161);
// 'arbitrum'
```

## Smart Account Architecture

This package uses Safe smart accounts with ERC-4337 support:

- **Safe Singleton**: `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762`
- **Safe 4337 Module**: `0xa581c4A4DB7175302464fF3C06380BC3270b4037` (v0.3.0)
- **Proxy Factory**: `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67`
- **EntryPoint**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (v0.7)

## Examples

### Batch Payment

```typescript
const result = await client.payBatch({
  payments: [
    { to: '0xAlice...', amount: 500000n },  // 0.5 USDT0
    { to: '0xBob...', amount: 300000n },    // 0.3 USDT0
    { to: '0xCharlie...', amount: 200000n }, // 0.2 USDT0
  ],
});

const receipt = await result.wait();
console.log(`Batch payment in tx: ${receipt.txHash}`);
```

### Check Sponsorship

```typescript
const sponsorship = await client.canSponsor({
  to: '0xRecipient...',
  amount: 1000000n,
});

if (sponsorship.canSponsor) {
  console.log('Payment will be free!');
} else {
  console.log(`Gas cost: ${sponsorship.estimatedGasCost} wei`);
}
```

### Using USDC Instead

```typescript
const result = await client.pay({
  to: '0xRecipient...',
  amount: 1000000n,
  token: 'USDC',
});
```

## License

Apache-2.0
