# @t402/wdk-multisig

Multi-sig Safe smart accounts with Tether WDK for M-of-N threshold payments.

## Features

- **Multi-Sig Payments**: Require M-of-N signatures for USDT0/USDC transfers
- **Gasless Execution**: ERC-4337 Account Abstraction with paymaster sponsorship
- **Signature Collection**: Async signature collection from multiple owners
- **Batch Payments**: Execute multiple transfers in a single transaction
- **Safe Smart Accounts**: Uses Gnosis Safe with 4337 module

## Installation

```bash
npm install @t402/wdk-multisig
# or
pnpm add @t402/wdk-multisig
```

### Peer Dependencies

```bash
npm install @tetherto/wdk @tetherto/wdk-wallet-evm
```

## Quick Start

```typescript
import { createMultiSigWdkGaslessClient } from '@t402/wdk-multisig';
import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

// Create a 2-of-3 multi-sig client
const client = await createMultiSigWdkGaslessClient({
  owners: [wdkAccount1, wdkAccount2, wdkAccount3],
  threshold: 2,
  publicClient,
  chainId: 42161,
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

// Execute payment with all signers available
const result = await client.payWithAllSigners(
  { to: '0xRecipient...', amount: 1000000n },
  [signer1, signer2],  // Only need 2 for 2-of-3
);

const receipt = await result.wait();
console.log('Payment confirmed:', receipt.txHash);
```

## API Reference

### `createMultiSigWdkGaslessClient(config)`

Creates a multi-sig gasless payment client.

```typescript
interface CreateMultiSigConfig {
  owners: WdkAccount[];          // Array of WDK owner accounts
  threshold: number;             // Required signatures (M of N)
  publicClient: PublicClient;    // Viem public client
  chainId: number;               // Chain ID
  bundler: BundlerConfig;        // Bundler configuration
  paymaster?: PaymasterConfig;   // Optional paymaster
  saltNonce?: bigint;            // Salt for address generation
}
```

### `MultiSigWdkGaslessClient`

#### Async Signature Collection Flow

For scenarios where signers are distributed:

```typescript
// 1. Initiate payment (creates unsigned UserOperation)
const payment = await client.initiatePayment({
  to: '0xRecipient...',
  amount: 1000000n,
});

console.log(`Request ID: ${payment.requestId}`);
console.log(`Needs ${payment.threshold} signatures`);

// 2. Collect signatures from owners (can be async/distributed)
await payment.addSignature(0, signer1);  // Owner at index 0
await payment.addSignature(1, signer2);  // Owner at index 1

// 3. Submit when threshold is met
const result = await payment.submit();
const receipt = await result.wait();
```

#### `initiatePayment(params): Promise<MultiSigPaymentResult>`

Create a payment request for signature collection.

```typescript
interface MultiSigPaymentResult {
  requestId: string;        // Unique request identifier
  sender: Address;          // Smart account address
  userOpHash: Hex;          // Hash for signing
  sponsored: boolean;       // Whether gas is sponsored
  threshold: number;        // Required signatures
  collectedCount: number;   // Current signature count
  isReady: boolean;         // Has enough signatures
  signatures: Map<Address, Hex>;  // Collected signatures
  addSignature(ownerIndex: number, signer: WDKSigner): Promise<void>;
  submit(): Promise<MultiSigSubmitResult>;
}
```

#### `initiateBatchPayment(params): Promise<MultiSigPaymentResult>`

Create a batch payment request.

```typescript
const payment = await client.initiateBatchPayment({
  payments: [
    { to: '0xAlice...', amount: 500000n },
    { to: '0xBob...', amount: 300000n },
  ],
});
```

#### `payWithAllSigners(params, signers): Promise<MultiSigSubmitResult>`

Execute payment when all signers are available locally.

```typescript
const result = await client.payWithAllSigners(
  { to: '0x...', amount: 1000000n },
  [signer1, signer2],  // Provide enough signers for threshold
);
```

#### `payBatchWithAllSigners(params, signers): Promise<MultiSigSubmitResult>`

Execute batch payment with all signers available.

#### `getOwners(): Address[]`

Get all owner addresses.

#### `getThreshold(): number`

Get the signature threshold.

#### `getPendingRequests(): SignatureRequest[]`

Get all pending signature requests.

#### `getPendingOwners(requestId): Address[]`

Get owners who haven't signed a specific request.

#### `getSignedOwners(requestId): Address[]`

Get owners who have signed a specific request.

#### `getBalance(token?): Promise<bigint>`

Get token balance of the multi-sig account.

#### `cleanup(): void`

Remove expired signature requests.

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

## Examples

### 2-of-3 Treasury Management

```typescript
// Create 2-of-3 multi-sig for treasury
const treasury = await createMultiSigWdkGaslessClient({
  owners: [ceoAccount, cfoAccount, cooAccount],
  threshold: 2,
  publicClient,
  chainId: 1,
  bundler: bundlerConfig,
  paymaster: paymasterConfig,
});

// CEO initiates payment
const payment = await treasury.initiatePayment({
  to: vendorAddress,
  amount: 50000_000000n,  // 50,000 USDT0
});

// Share requestId with other owners
console.log(`Request ID: ${payment.requestId}`);
console.log(`UserOp Hash: ${payment.userOpHash}`);

// CFO signs (can be on different device/service)
await treasury.signWithOwner(payment.requestId, 1, cfoSigner);

// Now threshold is met, submit
const result = await treasury.submitRequest(payment.requestId);
```

### Distributed Signing Service

```typescript
// Backend service that manages signature collection
class SignatureService {
  private client: MultiSigWdkGaslessClient;

  async requestSignature(requestId: string, ownerIndex: number) {
    // Notify owner (email, push notification, etc.)
    const pendingOwners = this.client.getPendingOwners(requestId);
    const request = this.client.getPendingRequests()
      .find(r => r.id === requestId);

    return {
      requestId,
      userOpHash: request?.userOpHash,
      pendingOwners,
      threshold: this.client.getThreshold(),
    };
  }

  async addSignature(requestId: string, ownerIndex: number, signature: Hex) {
    await this.client.addExternalSignature(requestId, ownerIndex, signature);

    const request = this.client.getPendingRequests()
      .find(r => r.id === requestId);

    if (request?.isReady) {
      return this.client.submitRequest(requestId);
    }

    return { status: 'pending', collected: request?.collectedCount };
  }
}
```

### Batch Payroll

```typescript
// Monthly payroll with multi-sig approval
const payroll = await client.initiateBatchPayment({
  payments: [
    { to: employee1, amount: 5000_000000n },
    { to: employee2, amount: 4500_000000n },
    { to: employee3, amount: 6000_000000n },
    { to: contractor1, amount: 3000_000000n },
  ],
});

// HR initiates, Finance approves
await payroll.addSignature(0, hrSigner);
await payroll.addSignature(1, financeSigner);

const result = await payroll.submit();
console.log(`Payroll executed: ${result.userOpHash}`);
```

## Error Handling

```typescript
import { MultiSigError } from '@t402/wdk-multisig';

try {
  const result = await client.submitRequest(requestId);
} catch (error) {
  if (error instanceof MultiSigError) {
    switch (error.code) {
      case 'REQUEST_NOT_FOUND':
        console.log('Request expired or invalid');
        break;
      case 'THRESHOLD_NOT_MET':
        console.log(`Need ${error.threshold} signatures, have ${error.collected}`);
        break;
      case 'OWNER_NOT_FOUND':
        console.log('Invalid owner index');
        break;
    }
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  MultiSigWdkGaslessClient                   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Owner 1    │  │   Owner 2    │  │   Owner 3    │       │
│  │  (WDK Acc)   │  │  (WDK Acc)   │  │  (WDK Acc)   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           ▼                                 │
│              ┌────────────────────────┐                     │
│              │  SignatureCollector    │                     │
│              │  (M-of-N threshold)    │                     │
│              └────────────┬───────────┘                     │
│                           ▼                                 │
│              ┌────────────────────────┐                     │
│              │  Safe 4337 Account     │                     │
│              │  (Smart Contract)      │                     │
│              └────────────┬───────────┘                     │
│                           ▼                                 │
│              ┌────────────────────────┐                     │
│              │  Bundler + Paymaster   │                     │
│              │  (ERC-4337)            │                     │
│              └────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## License

Apache-2.0
