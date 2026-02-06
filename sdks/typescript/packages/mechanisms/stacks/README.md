# @t402/stacks

Stacks (Bitcoin L2) implementation of the t402 payment protocol using the **exact-direct** payment scheme with SIP-010 fungible token transfers.

## Installation

```bash
npm install @t402/stacks
# or
pnpm add @t402/stacks
```

## Overview

This package provides support for sUSDC payments on Stacks using the exact-direct scheme. The client executes a `transfer` call on a SIP-010 token contract directly on-chain, then provides the transaction ID as proof of payment.

Three main components:

- **Client** - For applications that make payments (have Stacks wallets)
- **Facilitator** - For payment processors that verify transactions via the Hiro API
- **Server** - For resource servers that accept payments and build payment requirements

## Supported Networks

| Network | CAIP-2 Identifier | sUSDC Contract | Status |
|---------|-------------------|----------------|--------|
| Stacks Mainnet | `stacks:1` | `SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc` | Production |
| Stacks Testnet | `stacks:2147483648` | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc` | Testnet |

## Package Exports

### Main Package (`@t402/stacks`)

**Constants:**

- `STACKS_CAIP2_NAMESPACE` - CAIP-2 namespace (`stacks`)
- `STACKS_MAINNET_CAIP2` - Mainnet identifier (`stacks:1`)
- `STACKS_TESTNET_CAIP2` - Testnet identifier (`stacks:2147483648`)
- `STACKS_NETWORKS` - Array of supported networks
- `SCHEME_EXACT_DIRECT` - Scheme identifier
- `DEFAULT_MAINNET_API` - Mainnet Hiro API endpoint
- `DEFAULT_TESTNET_API` - Testnet Hiro API endpoint

**Tokens:**

- `TOKEN_REGISTRY` - Token configurations by network
- `getTokenConfig(network, symbol)` - Get token by symbol
- `getDefaultToken(network)` - Get default token
- `getContractAddress(network, symbol)` - Get contract address

**Utilities:**

- `isValidPrincipal(principal)` - Validate Stacks principal format
- `isValidTxId(txId)` - Validate transaction ID format
- `isStacksNetwork(network)` - Check if network is supported
- `getNetworkConfig(network)` - Get network configuration
- `formatAmount(amount, decimals)` - Format for display
- `parseAmount(amount, decimals)` - Convert to atomic units
- `extractTokenTransfer(events)` - Extract transfer from transaction events
- `comparePrincipals(a, b)` - Compare two Stacks principals

### Client (`@t402/stacks/exact-direct/client`)

```typescript
import { createExactDirectStacksClient } from "@t402/stacks/exact-direct/client";

const client = createExactDirectStacksClient({
  signer: myStacksSigner,
});
```

### Server (`@t402/stacks/exact-direct/server`)

```typescript
import { registerExactDirectStacksServer } from "@t402/stacks/exact-direct/server";

registerExactDirectStacksServer(server);
```

### Facilitator (`@t402/stacks/exact-direct/facilitator`)

```typescript
import { createExactDirectStacksFacilitator } from "@t402/stacks/exact-direct/facilitator";

const facilitator = createExactDirectStacksFacilitator(signer);
```

## Payment Flow

1. **Client** requests protected resource
2. **Server** responds with 402 + payment requirements (network, amount, payTo)
3. **Client** calls SIP-010 `transfer` on the sUSDC contract
4. **Client** submits transaction ID as payment proof
5. **Facilitator** queries Hiro API to verify the transaction
6. **Facilitator** confirms payment matches requirements

## Payload Structure

```typescript
interface ExactDirectStacksPayload {
  txId: string;             // Transaction ID (0x-prefixed hex)
  from: string;             // Sender principal
  to: string;               // Recipient principal
  amount: string;           // Amount in atomic units (6 decimals)
  contractAddress: string;  // SIP-010 contract address
}
```

## Principal Format

Stacks uses principal-based addressing:

- **Standard principals**: `SP` (mainnet) or `ST` (testnet) prefix + 33-41 alphanumeric characters
- **Contract principals**: `{standard-principal}.{contract-name}`

Examples:

```
SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K
SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc
```

## SIP-010 Token Standard

This package uses the SIP-010 fungible token standard on Stacks:

- `transfer(amount, sender, recipient, memo?)` - Transfer tokens
- `get-balance(owner)` - Query balance
- Tokens have 6 decimal places (sUSDC)

## CAIP-19 Asset Identifiers

Assets use CAIP-19 format:

```
stacks:1/sip010:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc
```

## Transaction Verification

The facilitator verifies payments by:

- Querying the Hiro API for transaction details
- Checking transaction status is `"success"`
- Extracting token transfer from events or post conditions
- Verifying: contract address, recipient, and amount (>= required)
- Replay prevention via transaction ID caching (24-hour default)
- Configurable max transaction age (1 hour default)

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
- `@t402/cosmos` - Cosmos (Noble) implementation
