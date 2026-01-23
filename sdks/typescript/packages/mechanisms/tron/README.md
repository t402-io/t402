# @t402/tron

TRON blockchain implementation of the t402 payment protocol using the **Exact** payment scheme with TRC-20 token transfers.

## Installation

```bash
npm install @t402/tron
```

## Overview

This package provides three main components for handling t402 payments on TRON:

- **Client** - For applications that need to make payments (sign TRC-20 transfers)
- **Server** - For resource servers that accept payments and build payment requirements
- **Facilitator** - For payment processors that verify signatures and execute on-chain settlements

## Quick Start

### Client

```typescript
import { ExactTronClient } from "@t402/tron/exact/client";

const client = new ExactTronClient(signer);
const payload = await client.createPaymentPayload(requirements);
```

### Server

```typescript
import { ExactTronServer } from "@t402/tron/exact/server";
import { t402ResourceServer } from "@t402/express";
import { HTTPFacilitatorClient } from "@t402/core/server";

const facilitator = new HTTPFacilitatorClient({ url: "https://facilitator.t402.io" });
const resourceServer = new t402ResourceServer(facilitator)
  .register("tron:mainnet", new ExactTronServer());
```

### Facilitator

```typescript
import { ExactTronFacilitator } from "@t402/tron/exact/facilitator";

const facilitator = new ExactTronFacilitator(signer);
```

## Package Exports

### Main Package (`@t402/tron`)

All constants, types, utilities, token registry, and scheme classes.

### Subpath Exports

- `@t402/tron/exact/client` - Client-only imports
- `@t402/tron/exact/server` - Server-only imports
- `@t402/tron/exact/facilitator` - Facilitator-only imports

## Supported Networks

| Network | CAIP-2 Identifier |
|---------|-------------------|
| TRON Mainnet | `tron:mainnet` |
| TRON Nile Testnet | `tron:nile` |
| TRON Shasta Testnet | `tron:shasta` |

## Supported Assets

| Token | Network | Contract Address |
|-------|---------|-----------------|
| USDT | Mainnet | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |
| USDT | Nile | `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf` |

## Token Utilities

```typescript
import {
  getDefaultToken,
  getTRC20Config,
  getNetworkTokens,
  getSupportedNetworks,
  isNetworkSupported,
} from "@t402/tron";

// Check if a network is supported
isNetworkSupported("tron:mainnet"); // true

// Get USDT config for mainnet
const config = getTRC20Config("tron:mainnet", "USDT");

// Get all supported networks
const networks = getSupportedNetworks();
```

## Address & Amount Utilities

```typescript
import {
  validateTronAddress,
  convertToSmallestUnits,
  convertFromSmallestUnits,
  estimateTransactionFee,
  formatAddress,
} from "@t402/tron";

// Validate TRON address (base58check T-prefix)
validateTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"); // true

// Convert amounts (6 decimals for USDT)
convertToSmallestUnits("1.5", 6); // 1500000n
convertFromSmallestUnits(1500000n, 6); // "1.5"
```

## Security

- Client signs TRC-20 transfer transactions using ECDSA (secp256k1)
- Replay protection via Protobuf nonce and expiration
- Facilitator verifies signatures before broadcasting to TRON network

## Development

```bash
pnpm build    # Build the package
pnpm test     # Run unit tests
pnpm test:integration  # Run integration tests
```

## Related Packages

- `@t402/core` - Core protocol types and client
- `@t402/fetch` - HTTP wrapper with automatic payment handling
- `@t402/evm` - EVM chains implementation
- `@t402/ton` - TON implementation
