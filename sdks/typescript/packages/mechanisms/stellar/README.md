# @t402/stellar

Stellar (Soroban) implementation of the t402 payment protocol. Supports USDC and other SEP-41 compatible Soroban tokens on Stellar Pubnet and Testnet.

## Installation

```bash
pnpm install @t402/stellar
```

## Overview

Provides client, server, and facilitator components for handling t402 payments on Stellar using pre-signed Soroban transactions (the **exact** scheme).

- **Client** — builds and signs Soroban transfer transactions
- **Server** — constructs payment requirements for resource servers
- **Facilitator** — verifies signatures and submits transactions to Horizon

## Quick Start

### Client

```typescript
import { t402Client } from "@t402/core/client";
import { ExactStellarScheme, toClientStellarSigner } from "@t402/stellar";
import { Keypair } from "@stellar/stellar-sdk";

const keypair = Keypair.fromSecret("S...");
const signer = toClientStellarSigner(keypair);

const client = new t402Client()
  .register("stellar:pubnet", new ExactStellarScheme(signer));
```

### Server

```typescript
import { registerExactStellarServerScheme } from "@t402/stellar";

const server = registerExactStellarServerScheme(t402Server, {
  network: "stellar:pubnet",
  recipient: "G...",
  token: "USDC",
});
```

### Facilitator

```typescript
import { registerExactStellarFacilitatorScheme, toFacilitatorStellarSigner } from "@t402/stellar";

const signer = toFacilitatorStellarSigner(facilitatorKeypair);
registerExactStellarFacilitatorScheme(facilitator, {
  network: "stellar:pubnet",
  signer,
});
```

## Supported Networks

| Network | CAIP-2 | Horizon | Soroban RPC |
|---------|--------|---------|-------------|
| Pubnet | `stellar:pubnet` | `https://horizon.stellar.org` | `https://soroban-rpc.stellar.org` |
| Testnet | `stellar:testnet` | `https://horizon-testnet.stellar.org` | `https://soroban-testnet.stellar.org` |

## Token Registry

```typescript
import { getTokenConfig, getUsdcNetworks, USDC_ADDRESSES } from "@t402/stellar";

const usdc = getTokenConfig("stellar:pubnet", "USDC");
const usdcNetworks = getUsdcNetworks();
```

## Utilities

- `normalizeNetwork`, `isStellarNetwork`, `getHorizonEndpoint`, `getSorobanEndpoint`
- `validateGAddress`, `validateCAddress`, `validateStellarAddress`
- `convertToTokenAmount`, `convertFromTokenAmount`, `calculateMaxLedger`

## Development

```bash
pnpm build
pnpm test
```

## License

Apache-2.0
