# @t402/aptos

Aptos implementation of the t402 payment protocol using the **exact-direct** payment scheme with Fungible Asset (FA) transfers.

## Installation

```bash
npm install @t402/aptos
# or
pnpm add @t402/aptos
```

## Overview

This package provides support for USDT/USDC payments on Aptos using the exact-direct scheme with the Fungible Asset standard. The client executes a `primary_fungible_store::transfer` call directly on-chain, then provides the transaction hash as proof of payment.

Three main components:

- **Client** - For applications that make payments (have Aptos wallets)
- **Facilitator** - For payment processors that verify transactions via Aptos REST API
- **Server** - For resource servers that accept payments and build payment requirements

## Supported Networks

| Network | CAIP-2 Identifier | Chain ID | USDT Metadata | Status |
|---------|-------------------|----------|---------------|--------|
| Aptos Mainnet | `aptos:1` | 1 | `0xf73e887a...` | Production |
| Aptos Testnet | `aptos:2` | 2 | `0xf73e887a...` | Testnet |
| Aptos Devnet | `aptos:149` | 149 | - | Development |

## Package Exports

### Main Package (`@t402/aptos`)

**Constants:**
- `APTOS_MAINNET_CAIP2` - CAIP-2 identifier for mainnet (`aptos:1`)
- `APTOS_TESTNET_CAIP2` - CAIP-2 identifier for testnet (`aptos:2`)
- `APTOS_DEVNET_CAIP2` - CAIP-2 identifier for devnet (`aptos:149`)
- `APTOS_NETWORKS` - Array of supported networks
- `FA_TRANSFER_FUNCTION` - Transfer function identifier
- `DEFAULT_MAINNET_RPC` - Default Aptos Labs RPC endpoint

**Tokens:**
- `TOKEN_REGISTRY` - Token configurations by network
- `getTokenConfig(network, symbol)` - Get token by symbol
- `getTokenByAddress(network, metadataAddress)` - Get token by metadata address
- `getSupportedTokens(network)` - Get all tokens for network
- `getDefaultToken(network)` - Get default token (USDT)
- `isTokenSupported(network, symbol)` - Check token support

**Utilities:**
- `isValidAptosAddress(address)` - Validate hex address format
- `normalizeAptosAddress(address)` - Normalize to 64-char format
- `compareAddresses(addr1, addr2)` - Compare addresses (case-insensitive)
- `isValidTxHash(txHash)` - Validate transaction hash
- `isAptosNetwork(network)` - Check if network is Aptos
- `formatAmount(amount, decimals)` - Format for display
- `parseAmount(amount, decimals)` - Parse to smallest units
- `extractTransferDetails(tx)` - Extract transfer from transaction
- `isFATransferTransaction(tx)` - Check if tx is FA transfer

### Client (`@t402/aptos/exact-direct/client`)

```typescript
import { createExactDirectAptosClient } from '@t402/aptos/exact-direct/client';

const client = createExactDirectAptosClient({
  signer: myAptosSigner,
});
```

### Server (`@t402/aptos/exact-direct/server`)

```typescript
import { registerExactDirectAptosServer } from '@t402/aptos/exact-direct/server';

registerExactDirectAptosServer(server);
```

### Facilitator (`@t402/aptos/exact-direct/facilitator`)

```typescript
import { createExactDirectAptosFacilitator } from '@t402/aptos/exact-direct/facilitator';

const facilitator = createExactDirectAptosFacilitator(signer);
```

## Payment Flow

1. **Client** requests protected resource
2. **Server** responds with 402 + payment requirements (network, amount, payTo)
3. **Client** calls `0x1::primary_fungible_store::transfer` with FA metadata
4. **Client** submits transaction hash as payment proof
5. **Facilitator** queries Aptos REST API to verify the transaction
6. **Facilitator** confirms payment matches requirements

## Payload Structure

```typescript
interface ExactDirectAptosPayload {
  txHash: string;           // 0x-prefixed transaction hash
  from: string;             // Sender address (0x...)
  to: string;               // Recipient address
  amount: string;           // Amount in smallest units
  metadataAddress: string;  // FA metadata object address
  version?: string;         // Transaction version (optional)
}
```

## Address Format

Aptos uses hex addresses:
- Prefixed with `0x`
- 1-64 hex characters (leading zeros can be omitted)
- Full format: 64 hex characters

Examples:
```
0x1                                                                (short form)
0x0000000000000000000000000000000000000000000000000000000000000001  (full form)
0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb  (USDT metadata)
```

## Fungible Asset Standard

This package uses Aptos Fungible Asset (FA) standard:
- Modern replacement for legacy Coin module
- Metadata object identifies the asset
- `primary_fungible_store::transfer` for transfers

```typescript
// Transfer function call
{
  function: "0x1::primary_fungible_store::transfer",
  arguments: [
    metadataAddress,  // FA metadata object
    recipientAddress, // Recipient
    amount            // Amount in smallest units
  ]
}
```

## Token Metadata Addresses

| Token | Mainnet Metadata Address |
|-------|-------------------------|
| USDT | `0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb` |
| USDC | `0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b` |

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
- `@t402/evm` - EVM chains implementation
- `@t402/near` - NEAR Protocol implementation
