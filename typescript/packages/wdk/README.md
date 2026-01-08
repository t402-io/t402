# @t402/wdk

> T402 integration with Tether Wallet Development Kit (WDK)

This package provides seamless integration between the T402 payment protocol and [Tether's WDK](https://wallet.tether.io/), enabling self-custodial USDT0 payments with EIP-3009 gasless transfers.

## Features

- **Multi-chain Wallets** - Manage wallets across Ethereum, Arbitrum, Base, and more
- **T402-Compatible Signers** - Ready-to-use signers for T402 HTTP payments
- **Balance Aggregation** - View balances across all configured chains
- **Cross-chain Bridging** - Bridge USDT0 between chains via LayerZero OFT
- **Balance Caching** - Reduce RPC calls with configurable TTL caching
- **Comprehensive Error Handling** - Typed errors with retry logic

## Installation

```bash
npm install @t402/wdk
# or
pnpm add @t402/wdk
```

You'll also need Tether WDK packages:

```bash
npm install @tetherto/wdk @tetherto/wdk-wallet-evm
# Optional: for bridging support
npm install @tetherto/wdk-protocol-bridge-usdt0-evm
```

## Quick Start

### 1. Register WDK Modules

Before using T402WDK, register the Tether WDK modules once at app startup:

```typescript
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import BridgeUsdt0Evm from '@tetherto/wdk-protocol-bridge-usdt0-evm'; // Optional
import { T402WDK } from '@t402/wdk';

// Register WDK modules (once at app startup)
T402WDK.registerWDK(WDK, WalletManagerEvm, BridgeUsdt0Evm);
```

### 2. Create a Wallet

```typescript
// Generate a new seed phrase
const seedPhrase = T402WDK.generateSeedPhrase();

// Or use an existing seed phrase
const seedPhrase = 'your twelve word seed phrase here ...';

// Create wallet with chain configurations
const wallet = new T402WDK(seedPhrase, {
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
});
```

### 3. Get a Signer for T402 Payments

```typescript
import { createT402HTTPClient } from '@t402/core';

// Get signer for Arbitrum
const signer = await wallet.getSigner('arbitrum');

// Use with T402 HTTP client
const client = createT402HTTPClient({
  signers: [{ scheme: 'exact', signer }],
});

// Make paid requests
const response = await client.fetch('https://api.example.com/premium');
```

## API Reference

### T402WDK Class

#### Static Methods

```typescript
// Register WDK modules (required before creating instances)
T402WDK.registerWDK(WDK, WalletManagerEvm, BridgeUsdt0Evm?);

// Check registration status
T402WDK.isWDKRegistered(): boolean;
T402WDK.isWalletManagerRegistered(): boolean;
T402WDK.isBridgeRegistered(): boolean;

// Generate a new BIP-39 seed phrase
T402WDK.generateSeedPhrase(): string;
```

#### Constructor

```typescript
const wallet = new T402WDK(
  seedPhrase: string,           // BIP-39 mnemonic (12, 15, 18, 21, or 24 words)
  config: T402WDKConfig,        // Chain RPC configurations
  options?: T402WDKOptions      // Optional: cache settings
);
```

**Config Example:**

```typescript
const wallet = new T402WDK(seedPhrase, {
  // String shorthand (uses default chain settings)
  arbitrum: 'https://arb1.arbitrum.io/rpc',

  // Full config object
  ethereum: {
    provider: 'https://eth.llamarpc.com',
    chainId: 1,
    network: 'eip155:1',
  },
}, {
  // Optional cache configuration
  cache: {
    enabled: true,
    tokenBalanceTTL: 30000,      // 30 seconds
    nativeBalanceTTL: 15000,     // 15 seconds
    aggregatedBalanceTTL: 60000, // 60 seconds
  },
});
```

#### Instance Properties

```typescript
wallet.isInitialized: boolean;           // True if WDK is ready
wallet.initializationError: Error | null; // Error if initialization failed
wallet.isCacheEnabled: boolean;          // True if balance caching is enabled
```

#### Chain Management

```typescript
// Get all configured chain names
wallet.getConfiguredChains(): string[];
// Returns: ['arbitrum', 'ethereum', 'base']

// Get chain configuration
wallet.getChainConfig('arbitrum'): NormalizedChainConfig | undefined;

// Check if chain is configured
wallet.isChainConfigured('arbitrum'): boolean;

// Get chains that support USDT0
wallet.getUsdt0Chains(): string[];

// Get chains that support bridging
wallet.getBridgeableChains(): string[];
```

#### Signers

```typescript
// Get a T402-compatible signer for a chain
const signer = await wallet.getSigner('arbitrum', accountIndex?: number);

// Get wallet address
const address = await wallet.getAddress('arbitrum');

// Clear signer cache (forces re-initialization)
wallet.clearSignerCache();
```

#### Balance Operations

```typescript
// Get USDT0 balance on a chain
const usdt0Balance = await wallet.getUsdt0Balance('arbitrum');

// Get USDC balance on a chain
const usdcBalance = await wallet.getUsdcBalance('base');

// Get all balances for a chain
const chainBalance = await wallet.getChainBalances('arbitrum');
// Returns: { chain, network, native, tokens: [...] }

// Get aggregated balances across all chains
const allBalances = await wallet.getAggregatedBalances();
// Returns: { totalUsdt0, totalUsdc, chains: [...] }

// Find best chain for a payment amount
const best = await wallet.findBestChainForPayment(1000000n, 'USDT0');
// Returns: { chain: 'arbitrum', token: 'USDT0', balance: 5000000n } | null
```

#### Bridging

```typescript
// Check if bridging is possible
wallet.canBridge('arbitrum', 'ethereum'): boolean;

// Get available destinations from a chain
wallet.getBridgeDestinations('arbitrum'): string[];

// Bridge USDT0 between chains
const result = await wallet.bridgeUsdt0({
  fromChain: 'ethereum',
  toChain: 'arbitrum',
  amount: 100_000000n,  // 100 USDT0 (6 decimals)
  recipient?: '0x...',  // Optional, defaults to same wallet
});
// Returns: { txHash: '0x...', estimatedTime: 300 }
```

#### Cache Management

```typescript
// Get cache configuration
wallet.getCacheConfig(): BalanceCacheConfig;

// Get cache statistics
wallet.getCacheStats(): BalanceCacheStats;

// Invalidate all cached balances
wallet.invalidateBalanceCache();

// Invalidate cache for a specific chain
wallet.invalidateChainCache('arbitrum');

// Invalidate cache for a specific address
wallet.invalidateAddressCache('0x1234...');

// Dispose resources (call when done)
wallet.dispose();
```

### WDKSigner Class

The signer returned by `wallet.getSigner()` implements the T402 `ClientEvmSigner` interface:

```typescript
interface WDKSigner {
  readonly address: Address;

  // Sign EIP-712 typed data (used by T402 for EIP-3009)
  signTypedData(message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;

  // Sign a personal message
  signMessage(message: string | Uint8Array): Promise<`0x${string}`>;

  // Get native token balance
  getBalance(): Promise<bigint>;

  // Get ERC20 token balance
  getTokenBalance(tokenAddress: Address): Promise<bigint>;

  // Estimate gas for a transaction
  estimateGas(params: { to: Address; value?: bigint; data?: string }): Promise<bigint>;

  // Send a transaction
  sendTransaction(params: { to: Address; value?: bigint; data?: string }): Promise<{ hash: `0x${string}` }>;

  // Utility methods
  getChain(): string;
  getChainId(): number;
  getAccountIndex(): number;
  isInitialized: boolean;
}
```

## Error Handling

All errors are typed and include context information:

```typescript
import {
  WDKError,
  WDKInitializationError,
  ChainError,
  SignerError,
  SigningError,
  BalanceError,
  TransactionError,
  BridgeError,
  RPCError,
  WDKErrorCode,
  isWDKError,
  hasErrorCode,
  wrapError,
  withRetry,
  withTimeout,
} from '@t402/wdk';

try {
  const signer = await wallet.getSigner('polygon');
} catch (error) {
  if (isWDKError(error)) {
    console.error(`Error code: ${error.code}`);
    console.error(`Message: ${error.message}`);
    console.error(`Context:`, error.context);

    if (hasErrorCode(error, WDKErrorCode.CHAIN_NOT_CONFIGURED)) {
      console.error('Chain is not configured');
    }

    if (error.isRetryable()) {
      // Can retry this operation
    }
  }
}
```

### Error Codes

| Code Range | Category |
|------------|----------|
| 1xxx | Initialization errors |
| 2xxx | Chain configuration errors |
| 3xxx | Signer errors |
| 4xxx | Signing errors |
| 5xxx | Balance errors |
| 6xxx | Transaction errors |
| 7xxx | Bridge errors |
| 8xxx | RPC errors |

### Retry Utilities

```typescript
import { withRetry, withTimeout } from '@t402/wdk';

// Retry an operation with exponential backoff
const balance = await withRetry(
  () => signer.getBalance(),
  { maxRetries: 3, baseDelay: 500 }
);

// Add timeout to a promise
const result = await withTimeout(
  someAsyncOperation(),
  30000,  // 30 second timeout
  'Operation description'
);
```

## Supported Chains

| Chain | Chain ID | USDT0 | Bridging |
|-------|----------|-------|----------|
| Ethereum | 1 | ✅ | ✅ |
| Arbitrum | 42161 | ✅ | ✅ |
| Base | 8453 | ✅ | ✅ |
| Ink | 57073 | ✅ | ✅ |
| Berachain | 80094 | ✅ | ✅ |
| Unichain | 130 | ✅ | ✅ |

## Examples

### Complete Payment Flow

```typescript
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import { T402WDK } from '@t402/wdk';
import { createT402HTTPClient } from '@t402/core';

// 1. Setup (once at app startup)
T402WDK.registerWDK(WDK, WalletManagerEvm);

// 2. Create wallet
const wallet = new T402WDK(seedPhrase, {
  arbitrum: 'https://arb1.arbitrum.io/rpc',
});

// 3. Check balance before payment
const balance = await wallet.getUsdt0Balance('arbitrum');
console.log(`USDT0 Balance: ${balance / 1000000n} USDT0`);

// 4. Get signer and create client
const signer = await wallet.getSigner('arbitrum');
const client = createT402HTTPClient({
  signers: [{ scheme: 'exact', signer }],
});

// 5. Make paid request
const response = await client.fetch('https://api.example.com/premium');

// 6. Invalidate cache after payment
wallet.invalidateChainCache('arbitrum');
```

### Multi-Chain Balance Check

```typescript
const wallet = new T402WDK(seedPhrase, {
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
});

// Get all balances
const balances = await wallet.getAggregatedBalances();

console.log(`Total USDT0: ${balances.totalUsdt0 / 1000000n}`);
console.log(`Total USDC: ${balances.totalUsdc / 1000000n}`);

for (const chain of balances.chains) {
  console.log(`\n${chain.chain}:`);
  console.log(`  Native: ${chain.native}`);
  for (const token of chain.tokens) {
    console.log(`  ${token.symbol}: ${token.formatted}`);
  }
}
```

### Auto-Select Best Chain

```typescript
const amount = 50_000000n; // 50 USDT0

// Find the best chain with sufficient balance
const best = await wallet.findBestChainForPayment(amount);

if (best) {
  console.log(`Use ${best.token} on ${best.chain}`);
  const signer = await wallet.getSigner(best.chain);
  // Use signer for payment...
} else {
  console.log('Insufficient balance on all chains');
}
```

### Cross-Chain Bridge

```typescript
import BridgeUsdt0Evm from '@tetherto/wdk-protocol-bridge-usdt0-evm';

// Register with bridge support
T402WDK.registerWDK(WDK, WalletManagerEvm, BridgeUsdt0Evm);

const wallet = new T402WDK(seedPhrase, {
  ethereum: 'https://eth.llamarpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
});

// Check if bridging is possible
if (wallet.canBridge('ethereum', 'arbitrum')) {
  // Bridge 100 USDT0 from Ethereum to Arbitrum
  const result = await wallet.bridgeUsdt0({
    fromChain: 'ethereum',
    toChain: 'arbitrum',
    amount: 100_000000n,
  });

  console.log(`Bridge tx: ${result.txHash}`);
  console.log(`Estimated time: ${result.estimatedTime}s`);
}
```

## Testing

For testing without actual WDK, use the MockWDKSigner:

```typescript
import { MockWDKSigner } from '@t402/wdk';

const mockSigner = new MockWDKSigner(
  '0x1234567890123456789012345678901234567890',
  '0xprivatekey...'
);

// Use in tests
const signature = await mockSigner.signTypedData({...});
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  T402WDKConfig,
  T402WDKOptions,
  T402BalanceCacheConfig,
  NormalizedChainConfig,
  TokenBalance,
  ChainBalance,
  AggregatedBalance,
  BridgeParams,
  BridgeResult,
  T402WDKSigner,
  WDKAccount,
  WDKInstance,
  WDKConstructor,
  CacheConfig,
  CacheStats,
  BalanceCacheConfig,
  BalanceCacheStats,
  RetryConfig,
} from '@t402/wdk';
```

## License

Apache 2.0
