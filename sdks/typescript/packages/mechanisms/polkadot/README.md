# @t402/polkadot

Polkadot Asset Hub implementation of the t402 payment protocol using the **exact-direct** payment scheme with Assets Pallet transfers.

## Installation

```bash
npm install @t402/polkadot
# or
pnpm add @t402/polkadot
```

## Overview

This package provides support for USDT payments on Polkadot Asset Hub parachains using the exact-direct scheme. The client executes the transfer directly on-chain, then provides the extrinsic hash as proof of payment.

Three main components:

- **Client** - For applications that make payments (have Polkadot wallets)
- **Facilitator** - For payment processors that verify extrinsics via Subscan
- **Server** - For resource servers that accept payments and build payment requirements

## Supported Networks

| Network | CAIP-2 Identifier | Asset ID | Status |
|---------|-------------------|----------|--------|
| Polkadot Asset Hub | `polkadot:68d56f15f85d3136970ec16946040bc1` | 1984 | Production |
| Kusama Asset Hub | `polkadot:48239ef607d7928...` | 1984 | Production |
| Westend Asset Hub | `polkadot:e143f23803ac50e8f6f8e62695d1ce9e` | 1984 | Testnet |

## Package Exports

### Main Package (`@t402/polkadot`)

**Constants:**
- `POLKADOT_ASSET_HUB_CAIP2` - CAIP-2 identifier for Polkadot Asset Hub
- `KUSAMA_ASSET_HUB_CAIP2` - CAIP-2 identifier for Kusama Asset Hub
- `WESTEND_ASSET_HUB_CAIP2` - CAIP-2 identifier for Westend testnet
- `POLKADOT_NETWORKS` - Array of supported networks
- `getNetworkConfig(network)` - Get network configuration

**Tokens:**
- `USDT_POLKADOT` - USDT token config (Asset ID: 1984)
- `TOKEN_REGISTRY` - Token configurations by network
- `getTokenConfig(network, symbol)` - Get token by symbol
- `getDefaultToken(network)` - Get default token for network

**Utilities:**
- `isValidAddress(address)` - Validate SS58 address format
- `isValidExtrinsicHash(hash)` - Validate extrinsic hash format
- `compareAddresses(addr1, addr2)` - Compare two addresses
- `formatAmount(amount, decimals)` - Format for display
- `parseAmount(amount, decimals)` - Parse to smallest units
- `extractAssetTransfer(extrinsic)` - Extract transfer details

### Client (`@t402/polkadot/exact-direct/client`)

```typescript
import { createExactDirectPolkadotClient } from '@t402/polkadot/exact-direct/client';

const client = createExactDirectPolkadotClient({
  signer: myPolkadotSigner,
});
```

### Server (`@t402/polkadot/exact-direct/server`)

```typescript
import { registerExactDirectPolkadotServer } from '@t402/polkadot/exact-direct/server';

registerExactDirectPolkadotServer(server);
```

### Facilitator (`@t402/polkadot/exact-direct/facilitator`)

```typescript
import { createExactDirectPolkadotFacilitator } from '@t402/polkadot/exact-direct/facilitator';

const facilitator = createExactDirectPolkadotFacilitator(signer);
```

## Payment Flow

1. **Client** requests protected resource
2. **Server** responds with 402 + payment requirements (network, amount, payTo)
3. **Client** executes `assets.transfer` extrinsic on Polkadot Asset Hub
4. **Client** submits extrinsic hash as payment proof
5. **Facilitator** queries Subscan API to verify the extrinsic
6. **Facilitator** confirms payment matches requirements

## Payload Structure

```typescript
interface ExactDirectPolkadotPayload {
  extrinsicHash: string;    // 0x-prefixed extrinsic hash
  blockHash: string;        // 0x-prefixed block hash
  extrinsicIndex: number;   // Index within block
  from: string;             // Sender SS58 address
  to: string;               // Recipient SS58 address
  amount: string;           // Amount in smallest units
  assetId: number;          // Asset ID (1984 for USDT)
}
```

## Address Format

Polkadot uses SS58 addresses:
- 45-50 characters
- Base58 encoded (no 0, O, I, l)
- Network-specific prefixes (0 for Polkadot, 2 for Kusama, 42 for generic)

Examples:
```
15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5  (Polkadot)
HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F  (Kusama)
```

## Development

```bash
# Build
pnpm build

# Test
pnpm test

# Test with coverage
pnpm test:coverage

# Lint
pnpm lint
```

## Related Packages

- `@t402/core` - Core protocol types and client
- `@t402/fetch` - HTTP wrapper with automatic payment handling
- `@t402/evm` - EVM implementation
- `@t402/svm` - Solana implementation
- `@t402/ton` - TON implementation
- `@t402/tron` - TRON implementation
- `@t402/near` - NEAR Protocol implementation
- `@t402/aptos` - Aptos implementation
- `@t402/tezos` - Tezos implementation
- `@t402/stacks` - Stacks implementation
- `@t402/cosmos` - Cosmos (Noble) implementation
