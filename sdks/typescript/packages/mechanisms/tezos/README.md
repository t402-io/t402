# @t402/tezos

Tezos implementation of the t402 payment protocol using the **exact-direct** payment scheme with FA2 token transfers (TZIP-12).

## Installation

```bash
npm install @t402/tezos
# or
pnpm add @t402/tezos
```

## Overview

This package provides support for USDT payments on Tezos using the exact-direct scheme. The client executes an FA2 `transfer` operation directly on-chain, then provides the operation hash as proof of payment.

Three main components:

- **Client** - For applications that make payments (have Tezos wallets)
- **Facilitator** - For payment processors that verify operations via TzKT
- **Server** - For resource servers that accept payments and build payment requirements

## Supported Networks

| Network | CAIP-2 Identifier | USDT Contract | Status |
|---------|-------------------|---------------|--------|
| Tezos Mainnet | `tezos:NetXdQprcVkpaWU` | `KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o` | Production |
| Tezos Ghostnet | `tezos:NetXnHfVqm9iesp` | - | Testnet |

## Package Exports

### Main Package (`@t402/tezos`)

**Constants:**
- `TEZOS_MAINNET_CAIP2` - CAIP-2 identifier for mainnet
- `TEZOS_GHOSTNET_CAIP2` - CAIP-2 identifier for ghostnet
- `DEFAULT_MAINNET_RPC` - Default RPC endpoint
- `DEFAULT_MAINNET_INDEXER` - TzKT API endpoint
- `getNetworkConfig(network)` - Get network configuration

**Tokens:**
- `USDT_MAINNET` - USDT token config on mainnet
- `TOKEN_REGISTRY` - Token configurations by network
- `getTokenBySymbol(network, symbol)` - Get token by symbol
- `getTokenByContract(network, address, tokenId)` - Get token by contract
- `getDefaultToken(network)` - Get default token

**Utilities:**
- `isValidTezosAddress(address)` - Validate tz1/tz2/tz3/KT1 address
- `isValidOperationHash(hash)` - Validate operation hash
- `isTezosNetwork(network)` - Check if network is Tezos
- `compareAddresses(addr1, addr2)` - Compare addresses
- `formatAmount(amount, decimals)` - Format for display
- `parseAmount(amount, decimals)` - Parse to smallest units
- `extractFA2TransferDetails(operation)` - Extract transfer from operation

### Client (`@t402/tezos/exact-direct/client`)

```typescript
import { createExactDirectTezosClient } from '@t402/tezos/exact-direct/client';

const client = createExactDirectTezosClient({
  signer: myTezosSigner,
});
```

### Server (`@t402/tezos/exact-direct/server`)

```typescript
import { registerExactDirectTezosServer } from '@t402/tezos/exact-direct/server';

registerExactDirectTezosServer(server);
```

### Facilitator (`@t402/tezos/exact-direct/facilitator`)

```typescript
import { createExactDirectTezosFacilitator } from '@t402/tezos/exact-direct/facilitator';

const facilitator = createExactDirectTezosFacilitator(signer);
```

## Payment Flow

1. **Client** requests protected resource
2. **Server** responds with 402 + payment requirements (network, amount, payTo)
3. **Client** calls FA2 `transfer` entrypoint on USDT contract
4. **Client** submits operation hash as payment proof
5. **Facilitator** queries TzKT API to verify the operation
6. **Facilitator** confirms payment matches requirements

## Payload Structure

```typescript
interface ExactDirectTezosPayload {
  opHash: string;           // Operation hash (starts with 'o')
  from: string;             // Sender address (tz1/tz2/tz3)
  to: string;               // Recipient address
  amount: string;           // Amount in smallest units
  contractAddress: string;  // FA2 contract (KT1...)
  tokenId: number;          // Token ID (0 for USDT)
}
```

## Address Formats

Tezos uses different address prefixes:
- `tz1` - Ed25519 public key hash
- `tz2` - Secp256k1 public key hash
- `tz3` - P256 public key hash
- `KT1` - Smart contract address

All addresses are 36 characters, Base58Check encoded.

Examples:
```
tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb  (implicit account)
KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o  (USDT contract)
```

## FA2 Token Standard

This package uses the FA2 (TZIP-12) token standard:
- Multi-asset contract support
- Token ID identifies specific token within contract
- Standard `transfer` entrypoint

```typescript
// FA2 transfer parameter structure
[{
  from_: "tz1...",
  txs: [{
    to_: "tz2...",
    token_id: 0,
    amount: "1000000"
  }]
}]
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
- `@t402/polkadot` - Polkadot Asset Hub implementation
- `@t402/stacks` - Stacks implementation
- `@t402/cosmos` - Cosmos (Noble) implementation
