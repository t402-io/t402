# ERC-4337 Gasless Transaction Example

This example demonstrates how to use ERC-4337 Account Abstraction for gasless transactions with T402.

## Features

- **Safe Smart Account**: Create a Safe-based smart account with 4337 module
- **Pimlico Bundler**: Submit UserOperations via Pimlico's bundler
- **Gas Sponsorship**: Use Pimlico paymaster for gasless transactions
- **ERC-4337 v0.7**: Full support for the latest EntryPoint version

## Prerequisites

1. **Pimlico API Key**: Get one at [dashboard.pimlico.io](https://dashboard.pimlico.io/)
2. **Owner Wallet**: An EOA private key that will own the Safe smart account
3. **Sponsorship Policy**: Configure a gas policy in Pimlico dashboard for sponsorship

## Environment Variables

```bash
# Required
OWNER_PRIVATE_KEY=0x...    # EOA private key (with 0x prefix)
PIMLICO_API_KEY=...        # Your Pimlico API key

# Optional
CHAIN_ID=84532             # Chain ID (default: Base Sepolia)
```

## Supported Chains

| Chain | Chain ID | Network |
|-------|----------|---------|
| Ethereum Mainnet | 1 | eth-mainnet |
| Ethereum Sepolia | 11155111 | eth-sepolia |
| Base | 8453 | base-mainnet |
| Base Sepolia | 84532 | base-sepolia |
| Optimism | 10 | opt-mainnet |
| Arbitrum One | 42161 | arb-mainnet |
| Polygon | 137 | polygon-mainnet |

## Running the Example

```bash
# Install dependencies
pnpm install

# Set environment variables
export OWNER_PRIVATE_KEY="0x..."
export PIMLICO_API_KEY="..."

# Run the example
pnpm tsx index.ts
```

## Code Overview

### 1. Create Safe Smart Account

```typescript
import { SafeSmartAccount } from "@t402/evm/erc4337";

const safeAccount = new SafeSmartAccount({
  owner,        // viem PrivateKeyAccount
  chainId,      // e.g., 84532 for Base Sepolia
  salt: 0n,     // For deterministic address
});

const address = await safeAccount.getAddress();
```

### 2. Connect to Bundler

```typescript
import { createBundlerClient } from "@t402/evm/erc4337";

const bundler = createBundlerClient("pimlico", {
  apiKey: pimlicoApiKey,
  chainId,
});

// Get gas prices
const gasPrice = await bundler.getUserOperationGasPrice();
```

### 3. Setup Paymaster

```typescript
import { createPaymaster } from "@t402/evm/erc4337";

const paymaster = createPaymaster("pimlico", {
  apiKey: pimlicoApiKey,
  chainId,
});

// Get sponsorship data
const paymasterData = await paymaster.getPaymasterData(userOp, chainId, entryPoint);
```

### 4. Build and Submit UserOperation

```typescript
// Encode the call
const callData = await safeAccount.encodeExecute(target, value, data);

// Build UserOp
const userOp = {
  sender: smartAccountAddress,
  nonce: 0n,
  initCode: await safeAccount.getInitCode(),
  callData,
  // ... gas fields from estimation
  paymasterAndData: paymasterData.toBytes(),
  signature: await safeAccount.signUserOpHash(userOpHash),
};

// Submit
const hash = await bundler.sendUserOperation(userOp);
const receipt = await bundler.waitForReceipt(hash);
```

## Alternative Providers

### Alchemy Bundler

```typescript
import { createBundlerClient, AlchemyPolicyConfig } from "@t402/evm/erc4337";

const bundler = createBundlerClient("alchemy", {
  apiKey: alchemyApiKey,
  chainId,
  policy: { policyId: "your-policy-id" },
});

// Combined gas + paymaster estimation
const result = await bundler.requestGasAndPaymasterAndData(userOp);
```

### Biconomy Paymaster

```typescript
import { createPaymaster } from "@t402/evm/erc4337";

const paymaster = createPaymaster("biconomy", {
  apiKey: biconomyApiKey,
  chainId,
  paymasterUrl: "https://paymaster.biconomy.io/api/v1/...",
  mode: "sponsored", // or "erc20"
});
```

### Stackup Paymaster

```typescript
const paymaster = createPaymaster("stackup", {
  apiKey: stackupApiKey,
  chainId,
  paymasterUrl: "https://api.stackup.sh/v1/paymaster/...",
});
```

## Batch Transactions

Execute multiple transactions in a single UserOperation:

```typescript
const callData = await safeAccount.encodeExecuteBatch(
  [target1, target2, target3],
  [value1, value2, value3],
  [data1, data2, data3],
);
```

## Resources

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Pimlico Documentation](https://docs.pimlico.io/)
- [Safe 4337 Module](https://github.com/safe-global/safe-modules)
- [T402 Documentation](https://t402.io/docs)
