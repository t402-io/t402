# @t402/wdk-facilitator

Adapter that lets a WDK (Wallet Development Kit) wallet act as a t402 facilitator signer. Use this to run a facilitator that settles EVM payments using a WDK-managed account.

## Installation

```bash
pnpm install @t402/wdk-facilitator
```

## Overview

`WdkFacilitatorAdapter` wraps a WDK-compatible wallet account and exposes the `FacilitatorEvmSigner` interface expected by `@t402/evm`. This lets any wallet that satisfies the structural WDK shape (including `@tetherto/wdk-wallet-evm`) plug into the t402 facilitator pipeline without bespoke integration code.

## Quick Start

```typescript
import { WdkFacilitatorAdapter } from "@t402/wdk-facilitator";
import { ExactEvmFacilitator } from "@t402/evm";

// Obtain a WDK-compatible wallet account
const wdkAccount = await myWdk.getAccount();

// Adapt it to a facilitator signer
const signer = new WdkFacilitatorAdapter(wdkAccount);

// Register with the EVM facilitator scheme
const facilitator = new ExactEvmFacilitator({ signer });
```

## API

### `WdkFacilitatorAdapter`

- `new WdkFacilitatorAdapter(wdkAccount)` — construct from a `WdkWalletAccount`
- Implements `FacilitatorEvmSigner` from `@t402/evm-core`:
  - `.address` — 0x-prefixed address
  - `.signTransaction(tx)` — returns signed serialized transaction
  - `.sendTransaction(tx)` — submits on-chain and returns hash

### Types

- `WdkWalletAccount` — structural interface matching WDK wallet shape
- `FacilitatorEvmSigner` — re-exported from `@t402/evm-core`

## Structural Typing

This package does not import `@tetherto/wdk` at runtime. It defines a minimal structural interface that matches any wallet satisfying the shape. Install `@tetherto/wdk-wallet-evm` as an optional peer dependency if you want Tether's official implementation.

## Development

```bash
pnpm build
pnpm test
```

## License

Apache-2.0
