# @t402/ton

TON blockchain implementation of the t402 payment protocol using the **Exact** payment scheme with Jetton (TEP-74) transfers.

## Installation

```bash
npm install @t402/ton
```

## Overview

This package provides three main components for handling t402 payments on TON:

- **Client** - For applications that need to make payments (sign Jetton transfer messages)
- **Server** - For resource servers that accept payments and build payment requirements
- **Facilitator** - For payment processors that verify signatures and execute on-chain settlements

## Quick Start

### Client

```typescript
import { ExactTonScheme, toClientTonSigner } from "@t402/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
const signer = toClientTonSigner(keyPair);

const client = new ExactTonScheme(signer);
const payload = await client.createPaymentPayload(requirements);
```

### Server

```typescript
import { registerExactTonServerScheme } from "@t402/ton";
import { t402ResourceServer } from "@t402/express";
import { HTTPFacilitatorClient } from "@t402/core/server";

const facilitator = new HTTPFacilitatorClient({ url: "https://facilitator.t402.io" });
const resourceServer = new t402ResourceServer(facilitator);
registerExactTonServerScheme(resourceServer);
```

### Facilitator

```typescript
import { registerExactTonFacilitatorScheme, toFacilitatorTonSigner } from "@t402/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
const signer = toFacilitatorTonSigner(keyPair);

registerExactTonFacilitatorScheme(facilitator, { signer });
```

## Package Exports

### Main Package (`@t402/ton`)

- `ExactTonScheme` - Main scheme class
- `registerExactTonClientScheme` - Register client with t402Client
- `registerExactTonServerScheme` - Register server with t402ResourceServer
- `registerExactTonFacilitatorScheme` - Register with facilitator
- `toClientTonSigner` / `toFacilitatorTonSigner` - Signer converters

### Subpath Exports

- `@t402/ton/exact/client` - Client-only imports
- `@t402/ton/exact/server` - Server-only imports
- `@t402/ton/exact/facilitator` - Facilitator-only imports

## Supported Networks

| Network | CAIP-2 Identifier |
|---------|-------------------|
| TON Mainnet | `ton:mainnet` |
| TON Testnet | `ton:testnet` |

## Supported Assets

| Token | Network | Jetton Address |
|-------|---------|----------------|
| USDT | Mainnet | `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs` |
| USDT | Testnet | `kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx` |

## Token Utilities

```typescript
import {
  getJettonConfig,
  getNetworkJettons,
  getDefaultJetton,
  getSupportedNetworks,
  isNetworkSupported,
} from "@t402/ton";

// Check if a network is supported
isNetworkSupported("ton:mainnet"); // true

// Get USDT config for mainnet
const config = getJettonConfig("ton:mainnet", "USDT");

// Get all supported networks
const networks = getSupportedNetworks();
```

## Address & Amount Utilities

```typescript
import {
  validateTonAddress,
  convertToJettonAmount,
  convertFromJettonAmount,
  buildJettonTransferBody,
  estimateJettonTransferGas,
} from "@t402/ton";

// Validate TON address
validateTonAddress("EQ..."); // true/false

// Convert amounts (6 decimals for USDT)
convertToJettonAmount("1.5", 6); // 1500000n
convertFromJettonAmount(1500000n, 6); // "1.5"
```

## Security

- Client signs Jetton transfer messages off-chain using Ed25519
- Replay protection via unique `query_id` per transaction
- Facilitator verifies signatures before broadcasting to TON network

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
- `@t402/svm` - Solana implementation
