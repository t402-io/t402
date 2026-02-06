# @t402/cosmos

Cosmos (Noble) implementation of the t402 payment protocol using the **exact-direct** payment scheme with native USDC via `MsgSend`.

## Installation

```bash
npm install @t402/cosmos
# or
pnpm add @t402/cosmos
```

## Overview

This package provides support for USDC payments on Cosmos SDK chains (currently Noble) using the exact-direct scheme. The client executes a `MsgSend` transaction directly on-chain, then provides the transaction hash as proof of payment.

Three main components:

- **Client** - For applications that make payments (have Cosmos wallets)
- **Facilitator** - For payment processors that verify transactions via REST API
- **Server** - For resource servers that accept payments and build payment requirements

## Supported Networks

| Network        | CAIP-2 Identifier  | USDC Denomination | Bech32 Prefix | Status     |
| -------------- | ------------------ | ----------------- | ------------- | ---------- |
| Noble Mainnet  | `cosmos:noble-1`   | `uusdc`           | `noble`       | Production |
| Noble Testnet  | `cosmos:grand-1`   | `uusdc`           | `noble`       | Testnet    |

## Package Exports

### Main Package (`@t402/cosmos`)

**Constants:**

- `NOBLE_MAINNET_CAIP2` - CAIP-2 identifier for Noble mainnet
- `NOBLE_TESTNET_CAIP2` - CAIP-2 identifier for Noble testnet
- `COSMOS_NETWORKS` - Array of supported networks
- `NETWORK_RPC_ENDPOINTS` - RPC endpoint mapping
- `NETWORK_REST_ENDPOINTS` - REST endpoint mapping
- `SCHEME_EXACT_DIRECT` - Scheme identifier
- `USDC_DENOM` - USDC denomination (`uusdc`)
- `MSG_TYPE_SEND` - Cosmos MsgSend type URL

**Tokens:**

- `TOKEN_REGISTRY` - Token configurations by network
- `getTokenConfig(network, symbol)` - Get token by symbol
- `getTokenByDenom(network, denom)` - Get token by denomination
- `getDefaultToken(network)` - Get default token
- `getNetworkTokens(network)` - Get all tokens for a network
- `isNetworkSupported(network)` - Check if network is supported

**Utilities:**

- `isValidAddress(address)` - Validate Noble bech32 address (`noble1...`)
- `normalizeNetwork(network)` - Normalize to CAIP-2 format
- `extractNetworkId(network)` - Extract network ID from CAIP-2
- `getRpcEndpoint(network)` - Get RPC endpoint for network
- `getRestEndpoint(network)` - Get REST endpoint for network
- `toAtomicUnits(amount, decimals)` - Convert decimal to smallest units
- `formatAmount(amount, decimals)` - Format for display

### Client (`@t402/cosmos/exact-direct/client`)

```typescript
import { ExactDirectCosmosClient } from "@t402/cosmos/exact-direct/client";

const client = new ExactDirectCosmosClient(signer);
const payload = await client.createPaymentPayload(2, requirements);
```

### Server (`@t402/cosmos/exact-direct/server`)

```typescript
import { ExactDirectCosmosServer } from "@t402/cosmos/exact-direct/server";

const server = new ExactDirectCosmosServer();
const assetAmount = await server.parsePrice(1.5, "cosmos:noble-1");
```

### Facilitator (`@t402/cosmos/exact-direct/facilitator`)

```typescript
import { ExactDirectCosmosFacilitator } from "@t402/cosmos/exact-direct/facilitator";

const facilitator = new ExactDirectCosmosFacilitator(signer);
const result = await facilitator.verify(2, payloadBytes, requirementsBytes);
```

## Payment Flow

1. **Client** requests protected resource
2. **Server** responds with 402 + payment requirements (network, amount, payTo)
3. **Client** broadcasts a `MsgSend` transaction on Noble chain
4. **Client** submits transaction hash as payment proof
5. **Facilitator** queries Noble REST API to verify the transaction
6. **Facilitator** confirms payment matches requirements (amount, recipient, denom)

## Payload Structure

```typescript
interface ExactDirectCosmosPayload {
  txHash: string; // Transaction hash
  from: string; // Sender bech32 address (noble1...)
  to: string; // Recipient bech32 address (noble1...)
  amount: string; // Amount in smallest units (uusdc)
  denom?: string; // Token denomination (default: uusdc)
}
```

## Address Format

Noble uses bech32 addresses with the `noble` prefix:

```
noble1qg5ega6dykkxc307y25pecuufrjkxkaggkkxh7
noble1m3h30wlvsf8llruxtpukdvsy0km2kum8g38c8q
```

## USDC on Noble

Noble is an appchain purpose-built for native USDC issuance in the Cosmos ecosystem:

- **Denomination**: `uusdc` (micro-USDC)
- **Decimals**: 6 (1 USDC = 1,000,000 uusdc)
- **Transfer**: Uses standard `cosmos.bank.v1beta1.MsgSend`

```typescript
// MsgSend structure
{
  "@type": "/cosmos.bank.v1beta1.MsgSend",
  fromAddress: "noble1sender...",
  toAddress: "noble1recipient...",
  amount: [{ denom: "uusdc", amount: "1000000" }]
}
```

## Gas Configuration

Default gas parameters:

- Gas limit: 200,000
- Gas price: 0.025 uusdc
- Default fee: 5,000 uusdc (0.005 USDC)

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
- `@t402/polkadot` - Polkadot Asset Hub implementation
- `@t402/stacks` - Stacks implementation
