# @t402/evm-core

T402 EVM Core Types and Utilities - Zero external dependencies.

## Overview

This package provides EVM types, constants, and utilities for the T402 payment protocol without requiring viem as a dependency. Use this package when you want to work with T402 EVM types without bundling the full viem library.

For full EVM functionality with viem integration, use `@t402/evm` instead.

## Installation

```bash
npm install @t402/evm-core
# or
pnpm add @t402/evm-core
```

## Usage

```typescript
import {
  // Primitive types
  type Address,
  type Hex,
  bytesToHex,
  hexToBytes,

  // Payment types
  type ExactEIP3009Payload,
  type UptoEIP2612Payload,

  // Constants
  authorizationTypes,
  eip3009ABI,

  // Signer interfaces
  type ClientEvmSigner,
  type FacilitatorEvmSigner,

  // Token registry
  TOKEN_REGISTRY,
  getTokenConfig,
  getNetworkTokens,

  // Utilities
  createNonce,
  getEvmChainId,
} from "@t402/evm-core";

// Use types without viem
const payload: ExactEIP3009Payload = {
  authorization: {
    from: "0x...",
    to: "0x...",
    value: "1000000",
    validAfter: "0",
    validBefore: "1893456000",
    nonce: createNonce(),
  },
};
```

## When to Use This Package

Use `@t402/evm-core` when:

- You only need types and don't need viem functionality
- You're building a type-only package that depends on T402 types
- You want to reduce bundle size by avoiding viem
- You're using a different EVM library (ethers.js, web3.js, etc.)

Use `@t402/evm` when:

- You need full EVM signing and verification
- You're using viem in your project
- You need the client or facilitator scheme implementations

## Exports

### Primitive Types

- `Address` - Ethereum address type (`` `0x${string}` ``)
- `Hex` - Hexadecimal string type
- `Bytes32` - 32-byte hex value
- `bytesToHex()` - Convert Uint8Array to hex
- `hexToBytes()` - Convert hex to Uint8Array

### Payment Types

- `ExactEIP3009Payload` - EIP-3009 TransferWithAuthorization payload
- `ExactLegacyPayload` - Legacy approve+transferFrom payload
- `UptoEIP2612Payload` - EIP-2612 Permit payload for metered payments
- `PermitSignature` - EIP-2612 signature components
- `PermitAuthorization` - EIP-2612 permit parameters

### Constants

- `authorizationTypes` - EIP-712 type definitions for EIP-3009
- `legacyAuthorizationTypes` - EIP-712 type definitions for legacy flow
- `eip3009ABI` - ABI for EIP-3009 token contracts
- `erc20LegacyABI` - ABI for standard ERC-20 operations

### Signer Interfaces

- `ClientEvmSigner` - Interface for client-side signing
- `FacilitatorEvmSigner` - Interface for facilitator operations
- `toClientEvmSigner()` - Convert to ClientEvmSigner
- `toFacilitatorEvmSigner()` - Convert to FacilitatorEvmSigner

### Token Registry

- `TOKEN_REGISTRY` - Complete token configuration by network
- `USDT0_ADDRESSES` - USDT0 contract addresses
- `USDC_ADDRESSES` - USDC contract addresses
- `getTokenConfig()` - Get token config by network/symbol
- `getNetworkTokens()` - Get all tokens for a network
- `getTokenByAddress()` - Find token by contract address
- `getEIP712Domain()` - Get EIP-712 domain for token

### Utilities

- `createNonce()` - Generate random 32-byte nonce
- `getEvmChainId()` - Get chain ID from network name

## License

Apache-2.0
