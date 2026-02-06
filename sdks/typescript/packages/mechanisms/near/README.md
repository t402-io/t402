# @t402/near

NEAR Protocol implementation of the t402 payment protocol using the **exact-direct** payment scheme with NEP-141 fungible token transfers.

## Installation

```bash
npm install @t402/near
# or
pnpm add @t402/near
```

## Overview

This package provides support for USDT/USDC payments on NEAR Protocol using the exact-direct scheme. The client executes an `ft_transfer` call directly on-chain, then provides the transaction hash as proof of payment.

Three main components:

- **Client** - For applications that make payments (have NEAR wallets)
- **Facilitator** - For payment processors that verify transactions via RPC
- **Server** - For resource servers that accept payments and build payment requirements

## Supported Networks

| Network      | CAIP-2 Identifier | USDT Contract            | USDC Contract                                                      | Status     |
| ------------ | ----------------- | ------------------------ | ------------------------------------------------------------------ | ---------- |
| NEAR Mainnet | `near:mainnet`    | `usdt.tether-token.near` | `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` | Production |
| NEAR Testnet | `near:testnet`    | -                        | `usdc.fakes.testnet`                                               | Testnet    |

## Package Exports

### Main Package (`@t402/near`)

**Constants:**

- `NEAR_MAINNET_CAIP2` - CAIP-2 identifier for mainnet
- `NEAR_TESTNET_CAIP2` - CAIP-2 identifier for testnet
- `NEAR_NETWORKS` - Array of supported networks
- `NETWORK_RPC_ENDPOINTS` - RPC endpoint mapping
- `SCHEME_EXACT_DIRECT` - Scheme identifier
- `DEFAULT_FT_TRANSFER_GAS` - Default gas for transfers (30 TGas)

**Tokens:**

- `TOKEN_REGISTRY` - Token configurations by network
- `getTokenConfig(network, symbol)` - Get token by symbol
- `getTokenByContract(network, contractId)` - Get token by contract
- `getDefaultToken(network)` - Get default token
- `isNetworkSupported(network)` - Check if network is supported

**Utilities:**

- `isValidAccountId(accountId)` - Validate NEAR account ID
- `normalizeNetwork(network)` - Normalize to CAIP-2 format
- `extractNetworkId(network)` - Extract network ID from CAIP-2
- `getRpcEndpoint(network)` - Get RPC endpoint for network
- `formatAmount(amount, decimals)` - Format for display
- `toTokenUnits(amount, decimals)` - Convert to smallest units
- `parseFtTransferArgs(argsBase64)` - Parse ft_transfer arguments
- `isTransactionSuccessful(status)` - Check transaction status

### Client (`@t402/near/exact-direct/client`)

```typescript
import { createExactDirectNearClient } from "@t402/near/exact-direct/client";

const client = createExactDirectNearClient({
  signer: myNearSigner,
});
```

### Server (`@t402/near/exact-direct/server`)

```typescript
import { registerExactDirectNearServer } from "@t402/near/exact-direct/server";

registerExactDirectNearServer(server);
```

### Facilitator (`@t402/near/exact-direct/facilitator`)

```typescript
import { createExactDirectNearFacilitator } from "@t402/near/exact-direct/facilitator";

const facilitator = createExactDirectNearFacilitator(signer);
```

## Payment Flow

1. **Client** requests protected resource
2. **Server** responds with 402 + payment requirements (network, amount, payTo)
3. **Client** calls `ft_transfer` on token contract with 1 yoctoNEAR deposit
4. **Client** submits transaction hash as payment proof
5. **Facilitator** queries NEAR RPC to verify the transaction
6. **Facilitator** confirms payment matches requirements

## Payload Structure

```typescript
interface ExactDirectNearPayload {
  txHash: string; // Transaction hash (Base58)
  from: string; // Sender account ID
  to: string; // Recipient account ID
  amount: string; // Amount in smallest units
}
```

## Account ID Format

NEAR uses human-readable account IDs:

- 2-64 characters
- Lowercase alphanumeric, underscores, hyphens
- Can have subaccounts (e.g., `sub.account.near`)

Examples:

```
alice.near
merchant.near
usdt.tether-token.near
```

## NEP-141 Token Standard

This package uses the NEP-141 fungible token standard:

- `ft_transfer(receiver_id, amount, memo?)` - Transfer tokens
- `ft_balance_of(account_id)` - Query balance
- Requires 1 yoctoNEAR deposit for security

```typescript
// ft_transfer arguments
{
  receiver_id: "merchant.near",
  amount: "1000000",
  memo: null
}
```

## Gas Configuration

Default gas amounts:

- `ft_transfer`: 30 TGas (30,000,000,000,000 gas)
- `storage_deposit`: 10 TGas

Required deposits:

- `ft_transfer`: 1 yoctoNEAR

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
- `@t402/aptos` - Aptos implementation
- `@t402/tezos` - Tezos implementation
- `@t402/polkadot` - Polkadot Asset Hub implementation
- `@t402/stacks` - Stacks implementation
- `@t402/cosmos` - Cosmos (Noble) implementation
