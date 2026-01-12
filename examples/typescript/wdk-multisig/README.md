# @t402/wdk-multisig Example

This example demonstrates how to use the `@t402/wdk-multisig` package for multi-sig Safe smart accounts with M-of-N threshold signatures using Tether WDK.

## Features

- **M-of-N Threshold Wallets**: Create Safe smart accounts with multiple owners
- **Single Seed Setup**: Multiple owners from one seed phrase (different HD paths)
- **Multi-party Setup**: Each participant controls their own seed phrase
- **Signature Collection**: Manage pending multi-party signature requests
- **Gasless Payments**: Send USDT0 without holding ETH for gas

## Prerequisites

1. Tether WDK account (`@tetherto/wdk`)
2. Bundler API key (e.g., [Pimlico](https://pimlico.io), [Alchemy](https://alchemy.com), [Stackup](https://stackup.sh))
3. Paymaster API key (optional, for sponsored transactions)

## Setup

```bash
# From this directory
pnpm install
```

## Run Demo

```bash
pnpm start
```

## Usage Examples

### Single Seed Multi-sig (Personal Security)

Create a 2-of-3 multi-sig where you control all keys from one seed phrase:

```typescript
import { createMultiSigFromSingleSeed } from '@t402/wdk-multisig';

const client = await createMultiSigFromSingleSeed({
  seedPhrase: 'word1 word2 ... word24',
  accountIndices: [0, 1, 2], // 3 owners from HD indices 0, 1, 2
  threshold: 2,              // 2-of-3 required
  chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
  chain: 'arbitrum',
  bundler: {
    bundlerUrl: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=...',
    chainId: 42161,
  },
});

// Check multi-sig address
console.log('Safe Address:', await client.getAccountAddress());
console.log('Owners:', client.getOwners());
console.log('Threshold:', client.getThreshold());

// Execute payment (all signers available locally)
const result = await client.payWithAllSigners(
  { to: '0xrecipient', amount: 1000000n },
  client.getSigners()
);

const receipt = await result.wait();
console.log('Payment confirmed:', receipt.txHash);
```

### Multi-party Multi-sig (Team Wallet)

Create a multi-sig where each party controls their own key:

```typescript
import { createMultiSigFromMultipleSeeds } from '@t402/wdk-multisig';

const client = await createMultiSigFromMultipleSeeds({
  seedPhrases: [partyASeed, partyBSeed, partyCSeed],
  threshold: 2, // 2-of-3
  chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
  chain: 'arbitrum',
  bundler: { bundlerUrl: '...', chainId: 42161 },
});

// Initiate payment (creates pending signature request)
const request = await client.initiatePayment({
  to: '0xrecipient',
  amount: 1000000n,
});

console.log('Request ID:', request.requestId);
console.log('Threshold:', request.threshold);

// Party A signs
await request.addSignature(0, partyASigner);
console.log('Signatures:', request.collectedCount, '/', request.threshold);

// Party B signs
await request.addSignature(1, partyBSigner);
console.log('Ready:', request.isReady); // true

// Submit when threshold met
const result = await request.submit();
const receipt = await result.wait();
console.log('Transaction:', receipt.txHash);
```

## API Reference

### `createMultiSigFromSingleSeed(config)`

Creates a multi-sig from a single seed phrase using different HD paths.

| Parameter | Type | Description |
|-----------|------|-------------|
| `seedPhrase` | `string` | BIP-39 seed phrase |
| `accountIndices` | `number[]` | HD wallet indices to use as owners |
| `threshold` | `number` | Number of signatures required |
| `chainConfig` | `T402WDKConfig` | Chain RPC configuration |
| `chain` | `string` | Chain to use (e.g., "arbitrum") |
| `bundler` | `BundlerConfig` | ERC-4337 bundler configuration |
| `paymaster` | `PaymasterConfig` | Optional paymaster for gas sponsorship |

### `createMultiSigFromMultipleSeeds(config)`

Creates a multi-sig where each party has their own seed.

| Parameter | Type | Description |
|-----------|------|-------------|
| `seedPhrases` | `string[]` | Array of seed phrases (one per owner) |
| `threshold` | `number` | Number of signatures required |
| `chainConfig` | `T402WDKConfig` | Chain RPC configuration |
| `chain` | `string` | Chain to use |
| `bundler` | `BundlerConfig` | ERC-4337 bundler configuration |
| `paymaster` | `PaymasterConfig` | Optional paymaster for gas sponsorship |

### `client.initiatePayment(params)`

Initiates a payment that requires multi-sig approval.

Returns `MultiSigPaymentResult` with:
- `requestId` - Unique request identifier
- `threshold` - Signatures required
- `collectedCount` - Signatures collected
- `isReady` - Whether threshold is met
- `addSignature(ownerIndex, signer)` - Add a signature
- `submit()` - Submit when ready

### `client.payWithAllSigners(params, signers)`

Executes a payment when all signers are available locally.

## Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| Ethereum | 1 | ✅ |
| Arbitrum | 42161 | ✅ |
| Base | 8453 | ✅ |
| Optimism | 10 | ✅ |
| Polygon | 137 | ✅ |
| Sepolia | 11155111 | ✅ |

## Security Considerations

1. **Key Isolation**: Each signer's seed phrase should be stored separately
2. **Threshold Selection**: Higher thresholds increase security but reduce availability
3. **Request Verification**: Always verify transaction details before signing
4. **Expiration**: Pending requests expire after 1 hour by default
